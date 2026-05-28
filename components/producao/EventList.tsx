import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

export function EventList({ events, bandSlug }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Nenhum evento em produção.</p>
        <p className="text-sm mt-1">Feche um lead no módulo Comercial para criar um evento.</p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {events.map(event => {
        const allItems = event.checklists.flatMap(c => c.items)
        const doneItems = allItems.filter(i => i.done).length
        const pct = allItems.length > 0 ? Math.round((doneItems / allItems.length) * 100) : 0
        const confirmedMusicians = event.event_musicians.filter(m => m.status === 'confirmed').length

        return (
          <Link
            key={event.id}
            href={`/${bandSlug}/producao/${event.id}`}
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div>
              <p className="font-medium text-gray-900">{event.client_name}</p>
              <p className="text-sm text-gray-500">
                {format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
                {event.venue_name && ` — ${event.venue_name}`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Checklist: {pct}% · Músicos confirmados: {confirmedMusicians}/{event.event_musicians.length}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[event.status]}`}>
              {statusLabels[event.status]}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
