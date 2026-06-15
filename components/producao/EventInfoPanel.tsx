'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

const statusLabels: Record<string, string> = {
  contracted: 'Contratado', active: 'Em andamento', done: 'Concluído',
}

const statusColors: Record<string, string> = {
  contracted: 'bg-blue-100 text-blue-700',
  active:     'bg-green-100 text-green-700',
  done:       'bg-gray-100 text-gray-600',
}

interface EventInfo {
  id: string
  client_name: string
  event_type: string
  event_date: string
  event_time: string | null
  venue_name: string
  venue_address: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  value: number
  status: string
}

interface EventInfoPanelProps {
  event: EventInfo
}

export function EventInfoPanel({ event }: EventInfoPanelProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<EventInfo>(event)

  const [form, setForm] = useState({
    client_name:     event.client_name,
    event_type:      event.event_type,
    event_date:      event.event_date.slice(0, 10),
    event_time:      event.event_time ?? '',
    venue_name:      event.venue_name,
    venue_address:   event.venue_address ?? '',
    venue_has_sound: event.venue_has_sound,
    venue_has_light: event.venue_has_light,
    value:           String(event.value),
  })

  function set(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleCancel() {
    setForm({
      client_name:     data.client_name,
      event_type:      data.event_type,
      event_date:      data.event_date.slice(0, 10),
      event_time:      data.event_time ?? '',
      venue_name:      data.venue_name,
      venue_address:   data.venue_address ?? '',
      venue_has_sound: data.venue_has_sound,
      venue_has_light: data.venue_has_light,
      value:           String(data.value),
    })
    setError('')
    setEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name:     form.client_name,
        event_type:      form.event_type,
        event_date:      form.event_date,
        event_time:      form.event_time || null,
        venue_name:      form.venue_name,
        venue_address:   form.venue_address || null,
        venue_has_sound: form.venue_has_sound,
        venue_has_light: form.venue_has_light,
        value:           parseFloat(form.value) || 0,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setData(prev => ({
        ...prev,
        client_name:     form.client_name,
        event_type:      form.event_type,
        event_date:      form.event_date,
        event_time:      form.event_time || null,
        venue_name:      form.venue_name,
        venue_address:   form.venue_address || null,
        venue_has_sound: form.venue_has_sound,
        venue_has_light: form.venue_has_light,
        value:           parseFloat(form.value) || 0,
      }))
      setEditing(false)
    } else {
      setError('Erro ao salvar. Tente novamente.')
    }
  }

  const dateDisplay = (() => {
    const [y, m, d] = data.event_date.slice(0, 10).split('-').map(Number)
    return format(new Date(y, m - 1, d), "dd 'de' MMMM yyyy", { locale: ptBR })
  })()

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          {editing ? (
            <Input
              value={form.client_name}
              onChange={e => set('client_name', e.target.value)}
              className="text-2xl font-bold h-10 w-72"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{data.client_name}</h1>
          )}
          {editing ? (
            <Input
              type="date"
              value={form.event_date}
              onChange={e => set('event_date', e.target.value)}
              className="mt-1 h-8 text-sm w-48"
            />
          ) : (
            <p className="text-gray-500">
              {dateDisplay}{data.event_time && ` às ${data.event_time}`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[data.status] ?? ''}`}>
            {statusLabels[data.status] ?? data.status}
          </span>
          <span className="text-xs text-gray-500">
            {editing ? (
              <select
                value={form.event_type}
                onChange={e => set('event_type', e.target.value)}
                className="border rounded px-1 py-0.5 text-xs"
              >
                {Object.entries(eventTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            ) : (
              eventTypeLabels[data.event_type] ?? data.event_type
            )}
          </span>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={13} className="mr-1" /> Editar
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                <X size={13} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Informações do local */}
      <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded-lg p-4">
        <div>
          <span className="font-medium text-gray-700">Local:</span>{' '}
          {editing ? (
            <Input value={form.venue_name} onChange={e => set('venue_name', e.target.value)}
              className="mt-1 h-7 text-sm" />
          ) : (
            <span>{data.venue_name}</span>
          )}
        </div>
        <div>
          <span className="font-medium text-gray-700">Endereço:</span>{' '}
          {editing ? (
            <Input value={form.venue_address} onChange={e => set('venue_address', e.target.value)}
              className="mt-1 h-7 text-sm" placeholder="Cidade / endereço" />
          ) : (
            <span>{data.venue_address ?? '—'}</span>
          )}
        </div>
        <div>
          <span className="font-medium text-gray-700">Som:</span>{' '}
          {editing ? (
            <label className="inline-flex items-center gap-1 ml-1 cursor-pointer">
              <input type="checkbox" checked={form.venue_has_sound}
                onChange={e => set('venue_has_sound', e.target.checked)} />
              <span>Incluso</span>
            </label>
          ) : (
            <span>{data.venue_has_sound ? '✅ Incluso' : '❌ Providenciar'}</span>
          )}
        </div>
        <div>
          <span className="font-medium text-gray-700">Luz:</span>{' '}
          {editing ? (
            <label className="inline-flex items-center gap-1 ml-1 cursor-pointer">
              <input type="checkbox" checked={form.venue_has_light}
                onChange={e => set('venue_has_light', e.target.checked)} />
              <span>Incluso</span>
            </label>
          ) : (
            <span>{data.venue_has_light ? '✅ Incluso' : '❌ Providenciar'}</span>
          )}
        </div>
        <div>
          <span className="font-medium text-gray-700">Horário:</span>{' '}
          {editing ? (
            <Input value={form.event_time} onChange={e => set('event_time', e.target.value)}
              className="mt-1 h-7 text-sm" placeholder="Ex: 20:00" />
          ) : (
            <span>{data.event_time ?? '—'}</span>
          )}
        </div>
        <div>
          <span className="font-medium text-gray-700">Valor:</span>{' '}
          {editing ? (
            <Input type="number" value={form.value} onChange={e => set('value', e.target.value)}
              className="mt-1 h-7 text-sm" />
          ) : (
            <span>R$ {Number(data.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          )}
        </div>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}
