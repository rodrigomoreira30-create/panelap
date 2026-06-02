// components/dashboard/UpcomingEvents.tsx
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { UpcomingEvent } from './DashboardClient'

const eventTypeLabels: Record<string, string> = {
  wedding:   'Casamento',
  party:     'Festa',
  show:      'Show',
  corporate: 'Corporativo',
  other:     'Outro',
}

type Props = { events: UpcomingEvent[] }

export function UpcomingEvents({ events }: Props) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Próximos eventos</h3>
      {events.length === 0 ? (
        <p className="text-gray-400 text-sm">Nenhum evento próximo.</p>
      ) : (
        <ul className="space-y-3">
          {events.map(ev => (
            <li key={ev.id} className="flex items-start gap-3">
              <div className="min-w-[40px] text-center bg-gray-50 rounded p-1">
                <p className="text-sm font-bold text-gray-900 leading-none">
                  {format(parseISO(ev.eventDate), 'dd', { locale: ptBR })}
                </p>
                <p className="text-xs text-gray-400 uppercase">
                  {format(parseISO(ev.eventDate), 'MMM', { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{ev.clientName}</p>
                <p className="text-xs text-gray-400">
                  {eventTypeLabels[ev.eventType] ?? ev.eventType}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
