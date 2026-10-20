// components/dashboard/PeriodFilter.tsx
'use client'

import { useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  parsePeriodRange,
  resolvePresetRange,
  type AnalysisCriterion,
  type PeriodPreset,
} from '@/lib/dashboard-period'

export type PeriodSelection = {
  preset: PeriodPreset
  from: string
  to: string
  criterion: AnalysisCriterion
}

const PRESETS: { value: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { value: '7d',    label: '7 dias' },
  { value: '30d',   label: '30 dias' },
  { value: '90d',   label: '90 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'year',  label: 'Este ano' },
]

const CRITERIA: { value: AnalysisCriterion; label: string }[] = [
  { value: 'evento',      label: 'Data do evento' },
  { value: 'recebimento', label: 'Data do recebimento' },
]

export const DEFAULT_PRESET = '30d' as const

export function selectionForPreset(
  preset: Exclude<PeriodPreset, 'custom'>,
  criterion: AnalysisCriterion,
  today = new Date(),
): PeriodSelection {
  return { preset, criterion, ...resolvePresetRange(preset, today) }
}

function pillClass(active: boolean) {
  return `px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
    active
      ? 'bg-gray-900 text-white'
      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
  }`
}

type Props = {
  value: PeriodSelection
  onChange: (next: PeriodSelection) => void
}

export function PeriodFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(value.from)
  const [draftTo, setDraftTo] = useState(value.to)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraftFrom(value.from)
      setDraftTo(value.to)
      setError(null)
    }
    setOpen(next)
  }

  function apply() {
    const r = parsePeriodRange(draftFrom, draftTo)
    if ('error' in r) {
      setError(r.error)
      return
    }
    onChange({ ...value, preset: 'custom', from: draftFrom, to: draftTo })
    setOpen(false)
  }

  function clear() {
    onChange(selectionForPreset(DEFAULT_PRESET, value.criterion))
    setOpen(false)
  }

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        {PRESETS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(selectionForPreset(p.value, value.criterion))}
            className={pillClass(value.preset === p.value)}
          >
            {p.label}
          </button>
        ))}
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button type="button" className={`${pillClass(value.preset === 'custom')} inline-flex items-center gap-1.5`}>
              <CalendarRange size={14} />
              Personalizado
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-xs bg-white">
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-900">Período personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500 space-y-1">
                  <span>Data inicial</span>
                  <input
                    type="date"
                    aria-label="Data inicial"
                    value={draftFrom}
                    onChange={e => setDraftFrom(e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900"
                  />
                </label>
                <label className="text-xs text-gray-500 space-y-1">
                  <span>Data final</span>
                  <input
                    type="date"
                    aria-label="Data final"
                    value={draftTo}
                    onChange={e => setDraftTo(e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900"
                  />
                </label>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={clear}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Limpar filtro
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="px-3 py-1.5 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-700"
                >
                  Aplicar filtro
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
        <span>Critério financeiro:</span>
        <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
          {CRITERIA.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange({ ...value, criterion: c.value })}
              className={`px-2.5 py-1 rounded transition-colors ${
                value.criterion === c.value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
