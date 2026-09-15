'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle } from 'lucide-react'
import {
  fmt,
  DEFAULT_FINANCE_ITEMS,
  PERCENT_ELIGIBLE_CATEGORIES,
  CACHE_MUSICO_CATEGORY,
  type EventFinanceData,
  type EventFinanceTotals,
} from '@/lib/financas'

type FinanceResponse = { data: EventFinanceData; totals: EventFinanceTotals }

async function fetchFinance(eventoId: string): Promise<FinanceResponse> {
  const res = await fetch(`/api/events/${eventoId}/finance`)
  if (!res.ok) throw new Error('Falha ao carregar o financeiro do evento')
  return res.json()
}

function parseBR(raw: string): number {
  return parseFloat(raw.trim().replace(/\./g, '').replace(',', '.'))
}

function CurrencyInput({
  value,
  onCommit,
  className = '',
}: {
  value: number
  onCommit: (n: number) => void
  className?: string
}) {
  const [input, setInput] = useState(fmt(value))
  useEffect(() => setInput(fmt(value)), [value])

  return (
    <input
      type="text"
      value={input}
      onChange={e => setInput(e.target.value)}
      onBlur={() => {
        const parsed = parseBR(input)
        if (!isNaN(parsed) && parsed !== value) onCommit(parsed)
        else setInput(fmt(value))
      }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={`w-32 text-right text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  )
}

function useAutosave() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function trigger(fn: () => Promise<void>) {
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await fn()
      setStatus('saved')
      timer.current = setTimeout(() => setStatus('idle'), 1500)
    }, 600)
  }

  return { status, trigger }
}

export function EventFinanceTab({ eventoId }: { eventoId: string }) {
  const queryClient = useQueryClient()
  const queryKey = ['event-finance', eventoId]
  const { status, trigger } = useAutosave()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchFinance(eventoId),
  })

  async function patchFinance(patch: Record<string, unknown>) {
    trigger(async () => {
      const res = await fetch(`/api/financas/${data!.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) queryClient.invalidateQueries({ queryKey })
    })
  }

  async function patchItem(itemId: string, patch: Record<string, unknown>) {
    trigger(async () => {
      const res = await fetch(`/api/financas/${data!.data.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) queryClient.invalidateQueries({ queryKey })
    })
  }

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-gray-400 animate-pulse">Carregando financeiro...</div>
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
        <p className="text-sm">Não foi possível carregar o financeiro deste evento.</p>
        <button onClick={() => refetch()} className="text-sm underline hover:text-gray-700">Tentar novamente</button>
      </div>
    )
  }

  const { data: finance, totals } = data
  const musicianItems = finance.items.filter(i => i.category === CACHE_MUSICO_CATEGORY)
  const otherItems = DEFAULT_FINANCE_ITEMS.map(def => ({
    def,
    item: finance.items.find(i => i.category === def.category),
  }))

  const cards = [
    { label: 'Receita prevista', value: totals.revenueForecast, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Recebido',         value: totals.received,        color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'A receber',        value: totals.receivable,       color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Custos',           value: totals.costTotal,       color: 'text-red-600', bg: 'bg-red-50' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <span className="text-xs text-gray-400">
          {status === 'saving' && 'Salvando...'}
          {status === 'saved' && 'Salvo'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`rounded-lg border p-4 ${c.bg}`}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-sm font-bold ${c.color}`}>R$ {fmt(c.value)}</p>
          </div>
        ))}
        <div className={`rounded-lg border p-4 ${totals.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-gray-500 mb-1">Lucro / Margem</p>
          <p className={`text-sm font-bold ${totals.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            R$ {fmt(totals.profit)} ({totals.marginPercent === null ? '—' : `${totals.marginPercent.toFixed(1)}%`})
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Receita</h3>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <label className="text-xs text-gray-500">
            Receita prevista
            <CurrencyInput
              value={finance.expected_revenue}
              onCommit={v => patchFinance({ expected_revenue: v })}
              className="w-full mt-1"
            />
          </label>
          <label className="text-xs text-gray-500">
            Valor recebido
            <CurrencyInput
              value={finance.received_amount}
              onCommit={v => patchFinance({ received_amount: v })}
              className="w-full mt-1"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Equipe / Cachês</h3>
        {musicianItems.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum músico com cachê definido na Formação.</p>
        ) : (
          <div className="space-y-2">
            {musicianItems.map(item => (
              <div key={item.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => patchItem(item.id, { paid: !item.paid })} title={item.paid ? 'Marcar como não pago' : 'Marcar como pago'}>
                    {item.paid ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300" />}
                  </button>
                  <span className="text-sm text-gray-700">{item.label}</span>
                </div>
                <CurrencyInput value={item.amount} onCommit={v => patchItem(item.id, { amount: v })} />
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Total da equipe: R$ {fmt(musicianItems.reduce((s, i) => s + i.amount, 0))}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Outros custos</h3>
        <div className="space-y-2">
          {otherItems.map(({ def, item }) => {
            const percentEligible = PERCENT_ELIGIBLE_CATEGORIES.has(def.category)
            return (
              <div key={def.category} className="flex items-center justify-between border rounded-md px-3 py-2 gap-3">
                <div className="flex items-center gap-2 flex-1">
                  {item && (
                    <button onClick={() => patchItem(item.id, { paid: !item.paid })} title={item.paid ? 'Marcar como não pago' : 'Marcar como pago'}>
                      {item.paid ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300" />}
                    </button>
                  )}
                  <span className="text-sm text-gray-700">{def.label}</span>
                </div>
                {percentEligible && item && (
                  <label className="text-xs text-gray-400 flex items-center gap-1">
                    %
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={item.percent_of_revenue ?? ''}
                      placeholder="—"
                      onBlur={e => {
                        const v = e.target.value === '' ? null : parseFloat(e.target.value)
                        patchItem(item.id, { percent_of_revenue: v })
                      }}
                      className="w-16 border rounded px-1 py-0.5 text-right"
                    />
                  </label>
                )}
                {item && <CurrencyInput value={item.amount} onCommit={v => patchItem(item.id, { amount: v })} />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t pt-4 flex flex-wrap gap-6 justify-between text-sm">
        <div>
          <p className="text-gray-500">Resultado do evento</p>
          <p className={`font-bold ${totals.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            R$ {fmt(totals.profit)} ({totals.marginPercent === null ? '—' : `${totals.marginPercent.toFixed(1)}%`})
          </p>
        </div>
        <div>
          <p className="text-gray-500">Saldo em caixa (recebido − pago)</p>
          <p className={`font-bold ${totals.cashProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            R$ {fmt(totals.cashProfit)}
          </p>
        </div>
      </div>
    </div>
  )
}
