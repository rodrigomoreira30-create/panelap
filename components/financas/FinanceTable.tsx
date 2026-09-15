'use client'

import { useRouter, useParams } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { fmt, DEFAULT_FINANCE_ITEMS, type EventFinanceData } from '@/lib/financas'

interface FinanceTableProps {
  finances: EventFinanceData[]
  onFinanceUpdated: (f: EventFinanceData) => void
  onFinanceDeleted: (id: string) => void
}

function calcShowTotals(f: EventFinanceData) {
  const saldo      = f.expected_revenue - f.received_amount
  const totalCosts = f.items.reduce((s, i) => s + i.amount, 0)
  const lucroPrevi = f.expected_revenue - totalCosts
  const lucroReal  = f.received_amount - f.items.filter(i => i.paid).reduce((s, i) => s + i.amount, 0)
  return { saldo, totalCosts, lucroPrevi, lucroReal }
}

export function FinanceTable({ finances, onFinanceDeleted }: FinanceTableProps) {
  const router = useRouter()
  const { bandSlug } = useParams<{ bandSlug: string }>()

  function openEvent(financeEventId: string | null) {
    if (!financeEventId) return
    router.push(`/${bandSlug}/producao/${financeEventId}?tab=financeiro`)
  }

  async function deleteFinance(id: string) {
    if (!confirm('Remover o registro financeiro deste evento? O evento em si não será apagado.')) return
    const res = await fetch(`/api/financas/${id}`, { method: 'DELETE' })
    if (res.ok) onFinanceDeleted(id)
  }

  const stdCategories = new Set(DEFAULT_FINANCE_ITEMS.map(d => d.category))

  return (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-3 py-3 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-[180px] z-10">
              Categoria
            </th>
            {finances.map(f => {
              const [fy, fm, fd] = f.event_date.slice(0, 10).split('-').map(Number)
              const d = new Date(fy, fm - 1, fd)
              return (
                <th key={f.id} className="px-3 py-3 text-center min-w-[150px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-semibold text-gray-900 truncate max-w-[140px]" title={f.name}>{f.name}</span>
                    <span className="text-gray-400 text-[10px]">
                      {d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                    {f.product && <span className="text-indigo-500 text-[10px]">{f.product}</span>}
                    <button
                      onClick={() => deleteFinance(f.id)}
                      className="text-gray-300 hover:text-red-500 mt-1 transition-colors"
                      title="Remover financeiro deste evento"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </th>
              )
            })}
            <th className="px-3 py-3 text-right font-semibold text-gray-600 min-w-[120px] bg-gray-50">
              Total mês
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Receita prevista */}
          <tr className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 sticky left-0 bg-white text-gray-700 font-medium z-10">Receita prevista</td>
            {finances.map(f => (
              <td
                key={f.id}
                onClick={() => openEvent(f.event_id)}
                className="px-3 py-2 text-right text-xs font-medium tabular-nums text-green-700 cursor-pointer hover:bg-gray-100"
                title="Abrir evento"
              >
                {fmt(f.expected_revenue)}
              </td>
            ))}
            <td className="px-3 py-2 text-right font-semibold text-green-700 tabular-nums bg-gray-50">
              {fmt(finances.reduce((s, f) => s + f.expected_revenue, 0))}
            </td>
          </tr>

          {/* Valor recebido */}
          <tr className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 sticky left-0 bg-white text-gray-700 font-medium z-10">Valor recebido</td>
            {finances.map(f => (
              <td
                key={f.id}
                onClick={() => openEvent(f.event_id)}
                className="px-3 py-2 text-right text-xs font-medium tabular-nums text-green-600 cursor-pointer hover:bg-gray-100"
                title="Abrir evento"
              >
                {fmt(f.received_amount)}
              </td>
            ))}
            <td className="px-3 py-2 text-right font-semibold text-green-600 tabular-nums bg-gray-50">
              {fmt(finances.reduce((s, f) => s + f.received_amount, 0))}
            </td>
          </tr>

          {/* Saldo a receber */}
          <tr className="border-b bg-blue-50/60">
            <td className="px-3 py-2 sticky left-0 bg-blue-50 text-blue-700 font-medium z-10">Saldo a receber</td>
            {finances.map(f => (
              <td
                key={f.id}
                onClick={() => openEvent(f.event_id)}
                className="px-3 py-2 text-right text-xs font-medium tabular-nums text-blue-600 cursor-pointer hover:bg-gray-100"
                title="Abrir evento"
              >
                {fmt(calcShowTotals(f).saldo)}
              </td>
            ))}
            <td className="px-3 py-2 text-right font-semibold text-blue-600 tabular-nums bg-blue-50">
              {fmt(finances.reduce((s, f) => s + calcShowTotals(f).saldo, 0))}
            </td>
          </tr>

          {/* Seção Custos */}
          <tr className="bg-gray-100 border-b">
            <td colSpan={finances.length + 2} className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-100">
              Custos
            </td>
          </tr>

          {/* Items padrão */}
          {DEFAULT_FINANCE_ITEMS.map(def => (
            <tr key={def.category} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2 sticky left-0 bg-white text-gray-600 z-10">{def.label}</td>
              {finances.map(f => {
                const item = f.items.find(i => i.category === def.category)
                if (!item) {
                  return (
                    <td
                      key={f.id}
                      onClick={() => openEvent(f.event_id)}
                      className="px-3 py-2 text-right text-gray-300 cursor-pointer hover:bg-gray-100"
                      title="Abrir evento"
                    >
                      —
                    </td>
                  )
                }
                return (
                  <td
                    key={f.id}
                    onClick={() => openEvent(f.event_id)}
                    className={`px-3 py-2 text-right text-xs font-medium tabular-nums cursor-pointer hover:bg-gray-100 ${
                      item.paid ? 'text-green-600' : item.amount > 0 ? 'text-red-600' : 'text-gray-400'
                    }`}
                    title="Abrir evento"
                  >
                    {fmt(item.amount)}
                  </td>
                )
              })}
              <td className="px-3 py-2 text-right text-red-600 tabular-nums bg-gray-50">
                {fmt(finances.reduce((s, f) => {
                  const item = f.items.find(i => i.category === def.category)
                  return s + (item?.amount ?? 0)
                }, 0))}
              </td>
            </tr>
          ))}

          {/* Items customizados */}
          {finances.flatMap(f => f.items.filter(i => !stdCategories.has(i.category)).map(item => ({ f, item }))).length > 0 && (
            <>
              <tr className="bg-gray-50 border-b">
                <td colSpan={finances.length + 2} className="px-3 py-1 text-[10px] text-gray-400 uppercase sticky left-0 bg-gray-50">
                  Custos personalizados
                </td>
              </tr>
              {finances.flatMap(f =>
                f.items
                  .filter(i => !stdCategories.has(i.category))
                  .map(item => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 sticky left-0 bg-white text-gray-600 z-10">
                        {item.label}
                      </td>
                      {finances.map(fCol => {
                        if (fCol.id !== f.id) return <td key={fCol.id} className="px-3 py-2" />
                        return (
                          <td
                            key={fCol.id}
                            onClick={() => openEvent(f.event_id)}
                            className={`px-3 py-2 text-right text-xs font-medium tabular-nums cursor-pointer hover:bg-gray-100 ${
                              item.paid ? 'text-green-600' : 'text-red-600'
                            }`}
                            title="Abrir evento"
                          >
                            {fmt(item.amount)}
                          </td>
                        )
                      })}
                      <td className="bg-gray-50" />
                    </tr>
                  ))
              )}
            </>
          )}

          {/* Total Custos */}
          <tr className="bg-red-50/60 border-b">
            <td className="px-3 py-2 sticky left-0 bg-red-50 text-red-700 font-semibold z-10">Total de custos</td>
            {finances.map(f => (
              <td key={f.id} className="px-3 py-2 text-right text-red-700 font-semibold tabular-nums">
                {fmt(calcShowTotals(f).totalCosts)}
              </td>
            ))}
            <td className="px-3 py-2 text-right text-red-700 font-semibold tabular-nums bg-red-50">
              {fmt(finances.reduce((s, f) => s + calcShowTotals(f).totalCosts, 0))}
            </td>
          </tr>

          {/* Lucro previsto */}
          <tr className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 sticky left-0 bg-white text-gray-700 font-medium z-10">Lucro previsto</td>
            {finances.map(f => {
              const { lucroPrevi } = calcShowTotals(f)
              return (
                <td key={f.id} className={`px-3 py-2 text-right font-medium tabular-nums ${lucroPrevi >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(lucroPrevi)}
                </td>
              )
            })}
            <td className={`px-3 py-2 text-right font-semibold tabular-nums bg-gray-50 ${
              finances.reduce((s, f) => s + calcShowTotals(f).lucroPrevi, 0) >= 0 ? 'text-green-700' : 'text-red-600'
            }`}>
              {fmt(finances.reduce((s, f) => s + calcShowTotals(f).lucroPrevi, 0))}
            </td>
          </tr>

          {/* Lucro real */}
          <tr className="border-b bg-gray-50">
            <td className="px-3 py-3 sticky left-0 bg-gray-50 text-gray-900 font-bold z-10">Lucro real</td>
            {finances.map(f => {
              const { lucroReal } = calcShowTotals(f)
              return (
                <td key={f.id} className={`px-3 py-3 text-right font-bold tabular-nums ${lucroReal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(lucroReal)}
                </td>
              )
            })}
            <td className={`px-3 py-3 text-right font-bold tabular-nums bg-gray-100 ${
              finances.reduce((s, f) => s + calcShowTotals(f).lucroReal, 0) >= 0 ? 'text-green-700' : 'text-red-600'
            }`}>
              {fmt(finances.reduce((s, f) => s + calcShowTotals(f).lucroReal, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
