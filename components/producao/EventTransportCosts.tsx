'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Plus, Trash2 } from 'lucide-react'
import {
  fmt,
  parseBR,
  resolveItemAmount,
  summarizeCategory,
  TRANSPORTE_CATEGORY,
  type FinanceItemData,
} from '@/lib/financas'

const INITIAL_ROWS = 3

function MoneyInput({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number | null
  onCommit: (n: number) => void
  ariaLabel: string
}) {
  const shown = value === null ? '' : fmt(value)
  const [input, setInput] = useState(shown)
  useEffect(() => setInput(shown), [shown])

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={input}
      placeholder="0,00"
      onChange={e => setInput(e.target.value)}
      onBlur={() => {
        const parsed = parseBR(input)
        if (!isNaN(parsed) && parsed !== value) onCommit(parsed)
        else setInput(shown)
      }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className="w-32 text-right text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  )
}

function PaidToggle({ paid, onToggle }: { paid: boolean; onToggle: () => void }) {
  const label = paid ? 'Marcar como não pago' : 'Marcar como pago'
  return (
    <button onClick={onToggle} title={label} aria-label={label}>
      {paid ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300" />}
    </button>
  )
}

function TransportRow({
  item,
  revenueForecast,
  onPatch,
  onDelete,
}: {
  item: FinanceItemData
  revenueForecast: number
  onPatch: (patch: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(item.label)
  useEffect(() => setLabel(item.label), [item.label])

  return (
    <div className="flex items-center gap-2" data-testid="transporte-item">
      <PaidToggle paid={item.paid} onToggle={() => onPatch({ paid: !item.paid })} />
      <input
        type="text"
        aria-label="Nome / identificação do transporte"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => {
          const trimmed = label.trim()
          if (trimmed && trimmed !== item.label) onPatch({ label: trimmed })
          else setLabel(item.label)
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="flex-1 min-w-0 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <MoneyInput
        ariaLabel="Valor do transporte"
        value={resolveItemAmount(item, revenueForecast)}
        onCommit={v => onPatch({ amount: v })}
      />
      <button
        onClick={onDelete}
        title="Remover transporte"
        aria-label="Remover transporte"
        className="text-gray-300 hover:text-red-500 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/** Linha ainda não gravada: só vira registro quando a linha perde o foco com nome ou valor
 * preenchido — linhas deixadas em branco não criam nada no banco. */
function DraftRow({ onCreate }: { onCreate: (label: string, amount: number) => Promise<boolean> }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  // O blur do campo e o da linha disparam no mesmo evento, antes do re-render — o commit
  // lê os refs para não gravar o valor anterior ao que acabou de ser digitado.
  const labelRef = useRef('')
  const amountRef = useRef<number | null>(null)
  const saving = useRef(false)

  async function commit() {
    const trimmed = labelRef.current.trim()
    const value = amountRef.current ?? 0
    if (saving.current || (!trimmed && value === 0)) return
    saving.current = true
    await onCreate(trimmed || 'Transporte', value)
    saving.current = false
  }

  return (
    <div
      className="flex items-center gap-2"
      data-testid="transporte-rascunho"
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit() }}
    >
      <span title="Preencha o transporte para marcar o pagamento">
        <Circle size={16} className="text-gray-200" />
      </span>
      <input
        type="text"
        aria-label="Nome / identificação do novo transporte"
        placeholder="Ex.: Carro 1 — João"
        value={label}
        onChange={e => { labelRef.current = e.target.value; setLabel(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="flex-1 min-w-0 text-sm border border-dashed rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <MoneyInput
        ariaLabel="Valor do novo transporte"
        value={amount}
        onCommit={v => { amountRef.current = v; setAmount(v) }}
      />
      <span className="w-[14px]" />
    </div>
  )
}

/** Categoria Transporte de "Outros custos", detalhada em vários itens (um por carro,
 * motorista ou responsável). Cada item é um EventFinanceItem comum de categoria
 * `transporte`, então o total entra em custos/lucro/margem e no Financeiro Geral pela
 * mesma soma por categoria de `computeEventFinance` — sem estrutura paralela. */
export function EventTransportCosts({
  financeId,
  items,
  revenueForecast,
  onPatchItem,
  onChange,
}: {
  financeId: string
  items: FinanceItemData[]
  revenueForecast: number
  onPatchItem: (itemId: string, patch: Record<string, unknown>) => void
  onChange: () => void
}) {
  const summary = summarizeCategory(items, TRANSPORTE_CATEGORY, revenueForecast)
  const [expanded, setExpanded] = useState(false)
  const nextDraftId = useRef(0)
  const [drafts, setDrafts] = useState<number[]>(() =>
    Array.from({ length: Math.max(0, INITIAL_ROWS - summary.items.length) }, () => nextDraftId.current++)
  )
  const [error, setError] = useState<string | null>(null)

  async function createItem(draftId: number, label: string, amount: number) {
    setError(null)
    try {
      const res = await fetch(`/api/financas/${financeId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: TRANSPORTE_CATEGORY, label, amount }),
      })
      if (!res.ok) throw new Error()
      setDrafts(d => d.filter(id => id !== draftId))
      onChange()
      return true
    } catch {
      setError('Não foi possível salvar o transporte.')
      return false
    }
  }

  async function deleteItem(item: FinanceItemData) {
    if (item.paid && !confirm(`"${item.label}" já está marcado como pago. Remover mesmo assim?`)) return
    setError(null)
    try {
      const res = await fetch(`/api/financas/${financeId}/items/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onChange()
    } catch {
      setError('Não foi possível remover o transporte.')
    }
  }

  return (
    <div className="border rounded-md px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {/* Indicador agregado (não clicável): o pagamento é marcado em cada transporte. */}
          <span
            title={summary.allPaid ? 'Todos os transportes pagos' : 'Há transportes pendentes'}
            data-testid="transporte-indicador"
            data-paid={summary.allPaid}
          >
            {summary.allPaid
              ? <CheckCircle2 size={16} className="text-green-500" />
              : <Circle size={16} className="text-gray-300" />}
          </span>
          <span className="text-sm text-gray-700">Transporte</span>
          {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          {summary.total > 0 && (
            <span className="text-xs text-gray-400">
              Pago R$ {fmt(summary.paidTotal)} · Pendente R$ {fmt(summary.pendingTotal)}
            </span>
          )}
        </button>
        <span className="w-32 text-right text-sm font-medium text-gray-900 px-2 py-1" data-testid="transporte-total">
          R$ {fmt(summary.total)}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 pl-6">
          {summary.items.map(item => (
            <TransportRow
              key={item.id}
              item={item}
              revenueForecast={revenueForecast}
              onPatch={patch => onPatchItem(item.id, patch)}
              onDelete={() => deleteItem(item)}
            />
          ))}
          {drafts.map(id => (
            <DraftRow key={id} onCreate={(label, amount) => createItem(id, label, amount)} />
          ))}
          <button
            onClick={() => setDrafts(d => [...d, nextDraftId.current++])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <Plus size={12} /> Adicionar transporte
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
