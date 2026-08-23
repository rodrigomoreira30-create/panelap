'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react'

type EventStatus = 'contracted' | 'active' | 'done'

const statusLabels: Record<EventStatus, string> = {
  contracted: 'Contratado',
  active:     'Em andamento',
  done:       'Concluído',
}

const statusColors: Record<EventStatus, string> = {
  contracted: 'bg-blue-100 text-blue-700',
  active:     'bg-green-100 text-green-700',
  done:       'bg-gray-100 text-gray-600',
}

type ChecklistItemProgress = { id: string; done: boolean }
type ChecklistProgress = { id: string; items: ChecklistItemProgress[] }
type MusicianProgress = { id: string; status: string }

type EventWithProgress = {
  id: string
  client_name: string
  event_date: Date | string
  event_type: string
  venue_name: string
  status: EventStatus
  checklists: ChecklistProgress[]
  event_musicians: MusicianProgress[]
}

type Props = {
  events: EventWithProgress[]
  bandSlug: string
}

function getEventDate(event: EventWithProgress): Date {
  const iso = event.event_date instanceof Date
    ? event.event_date.toISOString()
    : String(event.event_date)
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function EventList({ events: initialEvents, bandSlug }: Props) {
  const router = useRouter()
  const [events, setEvents] = useState(initialEvents)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [filterKey, setFilterKey] = useState<string>('all')

  // Extrair meses únicos com eventos
  const monthOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { key: string; label: string }[] = []
    for (const ev of events) {
      const d = getEventDate(ev)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!seen.has(key)) {
        seen.add(key)
        options.push({
          key,
          label: format(d, 'MMMM yyyy', { locale: ptBR })
            .replace(/^\w/, c => c.toUpperCase()),
        })
      }
    }
    return options
  }, [events])

  const filtered = useMemo(() => {
    if (filterKey === 'all') return events
    return events.filter(ev => {
      const d = getEventDate(ev)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return key === filterKey
    })
  }, [events, filterKey])

  async function handleEquipeOk(e: React.MouseEvent, eventId: string) {
    e.preventDefault()
    e.stopPropagation()
    setLoadingId(eventId)
    setEvents(prev => prev.filter(ev => ev.id !== eventId))
    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
    } catch {
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  // Alertas: shows em até 15 dias sem nenhum músico confirmado
  const alertIds = useMemo(() => {
    const ids = new Set<string>()
    for (const ev of events) {
      const days = daysUntil(getEventDate(ev))
      const confirmed = ev.event_musicians.filter(m => m.status === 'confirmed').length
      if (days >= 0 && days <= 15 && ev.event_musicians.length > 0 && confirmed === 0) {
        ids.add(ev.id)
      }
      if (days >= 0 && days <= 15 && ev.event_musicians.length === 0) {
        ids.add(ev.id)
      }
    }
    return ids
  }, [events])

  const alertCount = useMemo(
    () => events.filter(ev => alertIds.has(ev.id)).length,
    [events, alertIds]
  )

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Nenhum evento em produção.</p>
        <p className="text-sm mt-1">Feche um lead no módulo Comercial para criar um evento.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Barra de filtros */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-gray-50 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Período:</span>
          <div className="relative">
            <select
              value={filterKey}
              onChange={e => setFilterKey(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos os períodos</option>
              {monthOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-gray-400">
            {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Alerta de shows sem equipe */}
        {alertCount > 0 && (
          <button
            onClick={() => setFilterKey('all')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg font-medium"
          >
            <AlertTriangle size={13} />
            {alertCount} show{alertCount !== 1 ? 's' : ''} em até 15 dias sem equipe confirmada
          </button>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Nenhum evento neste período.
        </div>
      ) : (
        <div className="divide-y">
          {filtered.map(event => {
            const allItems = event.checklists.flatMap(c => c.items)
            const doneItems = allItems.filter(i => i.done).length
            const pct = allItems.length > 0 ? Math.round((doneItems / allItems.length) * 100) : 0
            const confirmedMusicians = event.event_musicians.filter(m => m.status === 'confirmed').length
            const isAlert = alertIds.has(event.id)
            const days = daysUntil(getEventDate(event))

            return (
              <div
                key={event.id}
                className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${isAlert ? 'border-l-4 border-l-orange-400 bg-orange-50/30' : ''}`}
              >
                <a href={`/${bandSlug}/producao/${event.id}`} className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{event.client_name}</p>
                    {isAlert && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                        <AlertTriangle size={10} />
                        {days === 0 ? 'Hoje' : `${days}d`}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {format(getEventDate(event), "dd 'de' MMMM yyyy", { locale: ptBR })}
                    {event.venue_name && ` — ${event.venue_name}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Checklist: {pct}% · Músicos confirmados: {confirmedMusicians}/{event.event_musicians.length}
                  </p>
                </a>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[event.status]}`}>
                    {statusLabels[event.status]}
                  </span>
                  <button
                    onClick={(e) => handleEquipeOk(e, event.id)}
                    disabled={loadingId === event.id}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    title="Marcar equipe como confirmada e arquivar evento"
                  >
                    <CheckCircle size={13} />
                    Equipe OK
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
