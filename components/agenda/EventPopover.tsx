import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const statusColors: Record<string, string> = {
  contracted: 'bg-blue-500',
  active:     'bg-orange-500',
  done:       'bg-gray-400',
}

const typeLabels: Record<string, string> = {
  wedding:   'Casamento',
  party:     'Festa',
  show:      'Show',
  corporate: 'Corporativo',
  other:     'Outro',
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  resource: {
    status: string
    type: string
    musicians: string[]
  }
}

interface EventPopoverProps {
  event: CalendarEvent
}

export function EventPopover({ event }: EventPopoverProps) {
  return (
    <div className="p-3 space-y-2 max-w-xs">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColors[event.resource.status] ?? 'bg-gray-400'}`} />
        <span className="font-medium text-sm">{event.title}</span>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p>{format(event.start, "dd 'de' MMMM yyyy", { locale: ptBR })}</p>
        <p>Tipo: {typeLabels[event.resource.type] ?? event.resource.type}</p>
        {event.resource.musicians.length > 0 && (
          <p>Músicos: {event.resource.musicians.join(', ')}</p>
        )}
      </div>
    </div>
  )
}
