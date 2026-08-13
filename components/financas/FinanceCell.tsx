'use client'

import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { fmt } from '@/lib/financas'

interface FinanceCellProps {
  value: number
  readOnly?: boolean
  colorClass?: string
  paid?: boolean
  onPaidToggle?: () => void
  onSave: (newValue: number) => Promise<void>
}

function parseBR(raw: string): number {
  return parseFloat(raw.trim().replace(/\./g, '').replace(',', '.'))
}

export function FinanceCell({ value, readOnly = false, colorClass = '', paid, onPaidToggle, onSave }: FinanceCellProps) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  if (readOnly) {
    return (
      <td className={`px-3 py-2 text-right text-xs font-medium tabular-nums whitespace-nowrap ${colorClass}`}>
        {fmt(value)}
      </td>
    )
  }

  async function handleBlur() {
    setEditing(false)
    const parsed = parseBR(input)
    if (isNaN(parsed) || parsed === value) return
    setSaving(true)
    await onSave(parsed)
    setSaving(false)
  }

  if (editing) {
    return (
      <td className="px-1 py-1">
        <input
          autoFocus
          type="text"
          defaultValue={String(value)}
          onChange={e => setInput(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="w-24 text-right text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
    )
  }

  const effectiveColor = onPaidToggle && paid ? 'text-green-600' : colorClass

  return (
    <td
      className={`px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors ${effectiveColor} ${saving ? 'opacity-50' : ''}`}
      onClick={() => { setInput(fmt(value)); setEditing(true) }}
      title="Clique para editar"
    >
      <div className="flex items-center justify-end gap-1.5">
        {onPaidToggle && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onPaidToggle() }}
            title={paid ? 'Marcar como não pago' : 'Marcar como pago'}
            className="shrink-0 transition-colors"
          >
            {paid
              ? <CheckCircle2 size={13} className="text-green-500" />
              : <Circle size={13} className="text-gray-300 hover:text-gray-400" />
            }
          </button>
        )}
        <span>{fmt(value)}</span>
      </div>
    </td>
  )
}
