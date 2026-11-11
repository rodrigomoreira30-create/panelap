'use client'

import { useParams } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { fmt, DEFAULT_FINANCE_ITEMS, computeEventFinance, computeReceivedAmount, summarizeCategory, type EventFinanceData } from '@/lib/financas'
import { buildTeamMatrixRows, TEAM_CATEGORY_ORDER, TEAM_CATEGORY_LABELS } from '@/lib/financas-team-matrix'

/**
 * Célula de valor de um evento. Quando há evento vinculado, o conteúdo é um link nativo
 * para o Financeiro do evento aberto em NOVA ABA — o Financeiro Geral fica intacto
 * (mês, rolagem, filtros) e o usuário mantém Cmd/Ctrl+clique, botão do meio e
 * "Abrir em nova aba" do navegador. O padding fica no <a> para a área clicável ser a célula toda.
 */
function EventCell({
  href,
  padding = 'px-3 py-2',
  className,
  children,
}: {
  href: string | null
  padding?: string
  className: string
  children: React.ReactNode
}) {
  if (!href) return <td className={`${padding} ${className}`}>{children}</td>
  return (
    <td className={`p-0 hover:bg-gray-100 ${className}`}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`block ${padding}`}
        title="Abrir financeiro do evento em nova aba"
      >
        {children}
      </a>
    </td>
  )
}

interface FinanceTableProps {
  finances: EventFinanceData[]
  onFinanceUpdated: (f: EventFinanceData) => void
  onFinanceDeleted: (id: string) => void
}

export function FinanceTable({ finances, onFinanceDeleted }: FinanceTableProps) {
  const { bandSlug } = useParams<{ bandSlug: string }>()

  function eventHref(financeEventId: string | null) {
    if (!financeEventId) return null
    return `/${bandSlug}/producao/${financeEventId}?tab=financeiro`
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
              <EventCell
                key={f.id}
                href={eventHref(f.event_id)}
                className="text-right text-xs font-medium tabular-nums text-green-700"
              >
                {fmt(f.expected_revenue)}
              </EventCell>
            ))}
            <td className="px-3 py-2 text-right font-semibold text-green-700 tabular-nums bg-gray-50">
              {fmt(finances.reduce((s, f) => s + f.expected_revenue, 0))}
            </td>
          </tr>

          {/* Valor recebido */}
          <tr className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 sticky left-0 bg-white text-gray-700 font-medium z-10">Valor recebido</td>
            {finances.map(f => (
              <EventCell
                key={f.id}
                href={eventHref(f.event_id)}
                className="text-right text-xs font-medium tabular-nums text-green-600"
              >
                {fmt(computeReceivedAmount(f))}
              </EventCell>
            ))}
            <td className="px-3 py-2 text-right font-semibold text-green-600 tabular-nums bg-gray-50">
              {fmt(finances.reduce((s, f) => s + computeReceivedAmount(f), 0))}
            </td>
          </tr>

          {/* Saldo a receber */}
          <tr className="border-b bg-blue-50/60">
            <td className="px-3 py-2 sticky left-0 bg-blue-50 text-blue-700 font-medium z-10">Saldo a receber</td>
            {finances.map(f => (
              <EventCell
                key={f.id}
                href={eventHref(f.event_id)}
                className="text-right text-xs font-medium tabular-nums text-blue-600"
              >
                {fmt(computeEventFinance(f).receivable)}
              </EventCell>
            ))}
            <td className="px-3 py-2 text-right font-semibold text-blue-600 tabular-nums bg-blue-50">
              {fmt(finances.reduce((s, f) => s + computeEventFinance(f).receivable, 0))}
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
                // Uma categoria pode ter vários itens (ex.: Transporte detalhado por carro) —
                // a célula mostra sempre a soma, nunca uma linha por item.
                const summary = summarizeCategory(f.items, def.category, f.expected_revenue)
                if (summary.items.length === 0) {
                  return (
                    <EventCell
                      key={f.id}
                      href={eventHref(f.event_id)}
                      className="text-right text-gray-300"
                    >
                      —
                    </EventCell>
                  )
                }
                return (
                  <EventCell
                    key={f.id}
                    href={eventHref(f.event_id)}
                    className={`text-right text-xs font-medium tabular-nums ${
                      summary.allPaid ? 'text-green-600' : summary.pendingTotal > 0 ? 'text-red-600' : 'text-gray-400'
                    }`}
                  >
                    {fmt(summary.total)}
                  </EventCell>
                )
              })}
              <td className="px-3 py-2 text-right text-red-600 tabular-nums bg-gray-50">
                {fmt(finances.reduce((s, f) => s + summarizeCategory(f.items, def.category, f.expected_revenue).total, 0))}
              </td>
            </tr>
          ))}

          {/* Equipe / Cachês — uma linha por membro+função (não mais por participação em
              cada evento), com os valores distribuídos nas colunas dos eventos correspondentes. */}
          {(() => {
            const teamRows = buildTeamMatrixRows(finances)
            if (teamRows.length === 0) return null
            let lastCategory: typeof teamRows[number]['category'] | null = null
            return (
              <>
                <tr className="bg-gray-50 border-b">
                  <td colSpan={finances.length + 2} className="px-3 py-1 text-[10px] text-gray-400 uppercase sticky left-0 bg-gray-50">
                    Custos personalizados
                  </td>
                </tr>
                {teamRows.flatMap(row => {
                  const trs: React.ReactNode[] = []
                  if (row.category !== lastCategory) {
                    lastCategory = row.category
                    trs.push(
                      <tr key={`cat-${row.category}`} className="border-b">
                        <td colSpan={finances.length + 2} className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide sticky left-0 bg-white">
                          {TEAM_CATEGORY_LABELS[row.category]}
                        </td>
                      </tr>
                    )
                  }
                  const total = Object.values(row.cellsByFinanceId).reduce((s, c) => s + c.amount, 0)
                  trs.push(
                    <tr key={row.key} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 pl-5 sticky left-0 bg-white text-gray-600 z-10">
                        {row.label}
                      </td>
                      {finances.map(f => {
                        const cell = row.cellsByFinanceId[f.id]
                        if (!cell) {
                          return (
                            <EventCell
                              key={f.id}
                              href={eventHref(f.event_id)}
                              className="text-center text-gray-300"
                            >
                              —
                            </EventCell>
                          )
                        }
                        return (
                          <EventCell
                            key={f.id}
                            href={eventHref(f.event_id)}
                            className={`text-right text-xs font-medium tabular-nums ${
                              cell.paid ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {fmt(cell.amount)}
                          </EventCell>
                        )
                      })}
                      <td className="px-3 py-2 text-right text-red-600 tabular-nums bg-gray-50">
                        {fmt(total)}
                      </td>
                    </tr>
                  )
                  return trs
                })}
              </>
            )
          })()}

          {/* Total Custos */}
          <tr className="bg-red-50/60 border-b">
            <td className="px-3 py-2 sticky left-0 bg-red-50 text-red-700 font-semibold z-10">Total de custos</td>
            {finances.map(f => (
              <EventCell key={f.id} href={eventHref(f.event_id)} className="text-right text-red-700 font-semibold tabular-nums">
                {fmt(computeEventFinance(f).costTotal)}
              </EventCell>
            ))}
            <td className="px-3 py-2 text-right text-red-700 font-semibold tabular-nums bg-red-50">
              {fmt(finances.reduce((s, f) => s + computeEventFinance(f).costTotal, 0))}
            </td>
          </tr>

          {/* Lucro previsto */}
          <tr className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 sticky left-0 bg-white text-gray-700 font-medium z-10">Lucro previsto</td>
            {finances.map(f => {
              const { profit } = computeEventFinance(f)
              return (
                <EventCell key={f.id} href={eventHref(f.event_id)} className={`text-right font-medium tabular-nums ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(profit)}
                </EventCell>
              )
            })}
            <td className={`px-3 py-2 text-right font-semibold tabular-nums bg-gray-50 ${
              finances.reduce((s, f) => s + computeEventFinance(f).profit, 0) >= 0 ? 'text-green-700' : 'text-red-600'
            }`}>
              {fmt(finances.reduce((s, f) => s + computeEventFinance(f).profit, 0))}
            </td>
          </tr>

          {/* Lucro real */}
          <tr className="border-b bg-gray-50">
            <td className="px-3 py-3 sticky left-0 bg-gray-50 text-gray-900 font-bold z-10">Lucro real</td>
            {finances.map(f => {
              const { cashProfit } = computeEventFinance(f)
              return (
                <EventCell key={f.id} href={eventHref(f.event_id)} padding="px-3 py-3" className={`text-right font-bold tabular-nums ${cashProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(cashProfit)}
                </EventCell>
              )
            })}
            <td className={`px-3 py-3 text-right font-bold tabular-nums bg-gray-100 ${
              finances.reduce((s, f) => s + computeEventFinance(f).cashProfit, 0) >= 0 ? 'text-green-700' : 'text-red-600'
            }`}>
              {fmt(finances.reduce((s, f) => s + computeEventFinance(f).cashProfit, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
