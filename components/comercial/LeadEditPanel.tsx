'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pencil, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LeadStatusSelect } from './LeadStatusSelect'
import { TagsInput } from './TagsInput'

type Stage = { key: string; label: string }
type Source = { key: string; label: string }

interface LeadData {
  id: string
  client_name: string
  phone: string
  event_type: string
  event_date: string | null
  city: string | null
  venue_name: string | null
  budget: number | null
  venue_has_sound: boolean
  venue_has_light: boolean
  observations: string | null
  status: string
  source: string | null
  tags: string[]
  assignee: { id: string; name: string } | null
}

interface LeadEditPanelProps {
  lead: LeadData
  stages: Stage[]
  sources: Source[]
}

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

function toDateInput(isoOrNull: string | null) {
  if (!isoOrNull) return ''
  // Always take just the date part (YYYY-MM-DD) regardless of timezone
  return isoOrNull.slice(0, 10)
}

function formatDateDisplay(dateStr: string | null) {
  if (!dateStr) return null
  // Parse as local date to avoid timezone shift
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number)
  return format(new Date(year, month - 1, day), "dd 'de' MMMM yyyy", { locale: ptBR })
}

export function LeadEditPanel({ lead, stages, sources }: LeadEditPanelProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // `displayed` tracks what's shown in view mode — updates immediately after save
  const [displayed, setDisplayed] = useState<LeadData>(lead)

  const [form, setForm] = useState({
    client_name:     lead.client_name,
    phone:           lead.phone,
    event_date:      toDateInput(lead.event_date),
    city:            lead.city ?? '',
    venue_name:      lead.venue_name ?? '',
    budget:          lead.budget != null ? String(lead.budget) : '',
    venue_has_sound: lead.venue_has_sound,
    venue_has_light: lead.venue_has_light,
    observations:    lead.observations ?? '',
    source:          lead.source ?? '',
  })

  function set(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleCancel() {
    setForm({
      client_name:     displayed.client_name,
      phone:           displayed.phone,
      event_date:      toDateInput(displayed.event_date),
      city:            displayed.city ?? '',
      venue_name:      displayed.venue_name ?? '',
      budget:          displayed.budget != null ? String(displayed.budget) : '',
      venue_has_sound: displayed.venue_has_sound,
      venue_has_light: displayed.venue_has_light,
      observations:    displayed.observations ?? '',
      source:          displayed.source ?? '',
    })
    setError('')
    setEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name:     form.client_name,
        phone:           form.phone,
        event_date:      form.event_date || null,
        city:            form.city || null,
        venue_name:      form.venue_name || null,
        budget:          form.budget ? parseFloat(form.budget) : null,
        venue_has_sound: form.venue_has_sound,
        venue_has_light: form.venue_has_light,
        observations:    form.observations || null,
        source:          form.source || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      // Update displayed state immediately so view mode reflects the change
      setDisplayed(prev => ({
        ...prev,
        client_name:     form.client_name,
        phone:           form.phone,
        event_date:      form.event_date || null,
        city:            form.city || null,
        venue_name:      form.venue_name || null,
        budget:          form.budget ? parseFloat(form.budget) : null,
        venue_has_sound: form.venue_has_sound,
        venue_has_light: form.venue_has_light,
        observations:    form.observations || null,
        source:          form.source || null,
      }))
      setEditing(false)
      router.refresh()
    } else {
      setError('Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={form.client_name}
              onChange={e => set('client_name', e.target.value)}
              className="text-lg font-bold h-9"
            />
          ) : (
            <h2 className="text-xl font-bold truncate">{displayed.client_name}</h2>
          )}
          {editing ? (
            <Input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              className="mt-1 h-8 text-sm text-gray-500"
            />
          ) : (
            <p className="text-gray-500 text-sm">{displayed.phone}</p>
          )}
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="shrink-0">
            <Pencil size={13} className="mr-1" /> Editar
          </Button>
        ) : (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
              <X size={13} />
            </Button>
          </div>
        )}
      </div>

      {/* Status */}
      <LeadStatusSelect leadId={lead.id} currentStatus={displayed.status} stages={stages} />

      {/* Tags */}
      <TagsInput leadId={lead.id} initialTags={displayed.tags} />

      {/* Campos */}
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Tipo:</span>{' '}
          {eventTypeLabels[displayed.event_type] ?? displayed.event_type}
        </div>

        <div>
          <span className="font-medium">Fonte:</span>{' '}
          {editing ? (
            <Select value={form.source} onValueChange={v => set('source', v)}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue placeholder="Selecione a fonte" />
              </SelectTrigger>
              <SelectContent>
                {sources.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (() => {
            const src = sources.find(s => s.key === displayed.source)
            return src ? <span>{src.label}</span> : <span className="text-gray-400">Não informada</span>
          })()}
        </div>

        <div>
          <span className="font-medium">Data do evento:</span>{' '}
          {editing ? (
            <Input
              type="date"
              value={form.event_date}
              onChange={e => set('event_date', e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          ) : (
            formatDateDisplay(displayed.event_date) ?? (
              <span className="text-gray-400">Não informada</span>
            )
          )}
        </div>

        <div>
          <span className="font-medium">Cidade:</span>{' '}
          {editing ? (
            <Input
              value={form.city}
              onChange={e => set('city', e.target.value)}
              className="mt-1 h-8 text-sm"
              placeholder="Cidade"
            />
          ) : (
            displayed.city ?? <span className="text-gray-400">Não informada</span>
          )}
        </div>

        <div>
          <span className="font-medium">Local:</span>{' '}
          {editing ? (
            <Input
              value={form.venue_name}
              onChange={e => set('venue_name', e.target.value)}
              className="mt-1 h-8 text-sm"
              placeholder="Nome do local"
            />
          ) : (
            displayed.venue_name ?? <span className="text-gray-400">Não informado</span>
          )}
        </div>

        <div>
          <span className="font-medium">Orçamento:</span>{' '}
          {editing ? (
            <Input
              type="number"
              value={form.budget}
              onChange={e => set('budget', e.target.value)}
              className="mt-1 h-8 text-sm"
              placeholder="0,00"
            />
          ) : displayed.budget != null ? (
            `R$ ${displayed.budget.toLocaleString('pt-BR')}`
          ) : (
            <span className="text-gray-400">Não informado</span>
          )}
        </div>

        {editing ? (
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.venue_has_sound}
                onChange={e => set('venue_has_sound', e.target.checked)} />
              <span>Som incluso</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.venue_has_light}
                onChange={e => set('venue_has_light', e.target.checked)} />
              <span>Luz inclusa</span>
            </label>
          </div>
        ) : (
          <div className="flex gap-3">
            <span><span className="font-medium">Som:</span> {displayed.venue_has_sound ? 'Incluso' : 'Não incluso'}</span>
            <span><span className="font-medium">Luz:</span> {displayed.venue_has_light ? 'Incluso' : 'Não incluso'}</span>
          </div>
        )}

        {displayed.assignee && (
          <div><span className="font-medium">Responsável:</span> {displayed.assignee.name}</div>
        )}

        <div>
          <span className="font-medium">Observações:</span>
          {editing ? (
            <Textarea
              value={form.observations}
              onChange={e => set('observations', e.target.value)}
              className="mt-1 text-sm resize-none"
              rows={3}
              placeholder="Observações sobre o lead..."
            />
          ) : displayed.observations ? (
            <p className="text-gray-600 mt-1">{displayed.observations}</p>
          ) : (
            <span className="text-gray-400"> Nenhuma</span>
          )}
        </div>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}
