'use client'

import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { FinanceCell } from './FinanceCell'
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

export function FinanceTable({ finances, onFinanceUpdated, onFinanceDeleted }: FinanceTableProps) {
  const [newItemLabels, setNewItemLabels] = useState<Record<string, string>>({})
  const [addingFor, setAddingFor] = useState<string | null>(null)

  async function patchFinance(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/financas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const { data } = await res.json()
      onFinanceUpdated(data)
    }
  }

  async function patchItem(financeId: string, itemId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/financas/${financeId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const { data: updatedItem } = await res.json()
      const finance = finances.find(f => f.id === financeId)
      if (!finance) return
      onFinanceUpdated({
        ...finance,
        items: finance.items.map(i => i.id === itemId ? { ...i, ...updatedItem } : i),
      })
    }
  }

  async function deleteFinance(id: string) {
    if (!confirm('Excluir este show financeiro e todos os seus dados?')) return
    const res = await fetch(`/api/financas/${id}`, { method: 'DELETE' })
    if (res.ok) onFinanceDeleted(id)
  }

  async function addCustomItem(financeId: string) {
    const label = (newItemLabels[financeId] ?? '').trim()
    if (!label) return
    const res = await fetch(`/api/financas/${financeId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'custom', label, amount: 0 }),
    })
    if (res.ok) {
      const { data: newItem } = await res.json()
      const finance = finances.find(f => f.id === financeId)
      if (!finance) return
      onFinanceUpdated({ ...finance, items: [...finance.items, newItem] })
      setNewItemLabels(prev => ({ ...prev, [financeId]: '' }))
      setAddingFor(null)
    }
  }

  async function deleteItem(financeId: string, itemId: string) {
    const res = await fetch(`/api/financas/${financeId}/items/${itemId}`, { method: 'DELETE' })
    if (res.ok) {
      const finance = finances.find(f => f.id === financeId)
      if (!finance) return
      onFinanceUpdated({ ...finance, items: finance.items.filter(i => i.id !== itemId) })
    }
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
                      title="Excluir show"
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
              <FinanceCell key={f.id} value={f.expected_revenue} colorClass="text-green-700"
                onSave={v => patchFinance(f.id, { expected_revenue: v })} />
            ))}
            <td className="px-3 py-2 text-right font-semibold text-green-700 tabular-nums bg-gray-50">
              {fmt(finances.reduce((s, f) => s + f.expected_revenue, 0))}
            </td>
          </tr>

          {/* Valor recebido */}
          <tr className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 sticky left-0 bg-white text-gray-700 font-medium z-10">Valor recebido</td>
            {finances.map(f => (
              <FinanceCell key={f.id} value={f.received_amount} colorClass="text-green-600"
                onSave={v => patchFinance(f.id, { received_amount: v })} />
            ))}
            <td className="px-3 py-2 text-right font-semibold text-green-600 tabular-nums bg-gray-50">
              {fmt(finances.reduce((s, f) => s + f.received_amount, 0))}
            </td>
          </tr>

          {/* Saldo a receber */}
          <tr className="border-b bg-blue-50/60">
            <td className="px-3 py-2 sticky left-0 bg-blue-50 text-blue-700 font-medium z-10">Saldo a receber</td>
            {finances.map(f => (
              <FinanceCell key={f.id} value={calcShowTotals(f).saldo} readOnly colorClass="text-blue-600"
                onSave={async () => {}} />
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
                if (!item) return <td key={f.id} className="px-3 py-2 text-right text-gray-300">—</td>
                return (
                  <FinanceCell key={f.id} value={item.amount} colorClass={item.amount > 0 ? 'text-red-600' : 'text-gray-400'}
                    onSave={v => patchItem(f.id, item.id, { amount: v })} />
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
                        <div className="flex items-center gap-1">
                          <span>{item.label}</span>
                          <button onClick={() => deleteItem(f.id, item.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                      {finances.map(fCol => {
                        if (fCol.id !== f.id) return <td key={fCol.id} className="px-3 py-2" />
                        return (
                          <FinanceCell key={fCol.id} value={item.amount} colorClass="text-red-600"
                            onSave={v => patchItem(f.id, item.id, { amount: v })} />
                        )
                      })}
                      <td className="bg-gray-50" />
                    </tr>
                  ))
              )}
            </>
          )}

          {/* Adicionar custo */}
          <tr className="border-b">
            <td colSpan={finances.length + 2} className="px-3 py-2 sticky left-0">
              <div className="flex gap-3 flex-wrap">
                {finances.map(f => (
                  <div key={f.id} className="flex items-center gap-1">
                    {addingFor === f.id ? (
                      <>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Nome do custo"
                          value={newItemLabels[f.id] ?? ''}
                          onChange={e => setNewItemLabels(prev => ({ ...prev, [f.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addCustomItem(f.id) }}
                          className="text-xs border rounded px-2 py-1 w-36"
                        />
                        <button onClick={() => addCustomItem(f.id)} className="text-xs text-green-600 font-medium">OK</button>
                        <button onClick={() => setAddingFor(null)} className="text-xs text-gray-400">✕</button>
                      </>
                    ) : (
                      <button onClick={() => setAddingFor(f.id)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 whitespace-nowrap">
                        <Plus size={12} /> {f.name.length > 12 ? f.name.slice(0, 12) + '…' : f.name}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </td>
          </tr>

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
