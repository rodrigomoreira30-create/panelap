import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CalendarItem } from './CalendarView'

const eventStatusLabels: Record<string, string> = {
  contracted: 'Contratado',
  active:     'Ativo',
  done:       'Concluído',
}

const leadStatusLabels: Record<string, string> = {
  new_lead:      'Novo Lead',
  attending:     'Em Atendimento',
  proposal_sent: 'Proposta Enviada',
  negotiation:   'Negociação',
}

const typeLabels: Record<string, string> = {
  wedding:   'Casamento',
  party:     'Festa',
  show:      'Show',
  corporate: 'Corporativo',
  other:     'Outro',
}

export function EventPopover({ event }: { event: CalendarItem }) {
  const isLead = event.resource.kind === 'lead'

  return (
    <div className="p-3 space-y-2 max-w-xs">
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: isLead ? '#f59e0b' : '#3b82f6' }}
        />
        <span className="font-semibold text-sm">{event.title}</span>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>{format(new Date(event.start), "dd 'de' MMMM yyyy", { locale: ptBR })}</p>
        <p>Tipo: {typeLabels[event.resource.eventType] ?? event.resource.eventType}</p>
        {event.resource.venue && <p>Local: {event.resource.venue}</p>}

        {isLead ? (
          <p className="font-medium text-amber-600">
            Orçamento — {leadStatusLabels[event.resource.status] ?? event.resource.status}
          </p>
        ) : (
          <>
            <p className="font-medium text-blue-600">
              {eventStatusLabels[event.resource.status] ?? event.resource.status}
            </p>
            {event.resource.musicians.length > 0 && (
              <p>Músicos: {event.resource.musicians.join(', ')}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
