import { toDateKey } from './calendar-status'

export type CalendarItemData = {
  id: string
  title: string
  start: Date
  end: Date
  resource: {
    kind: 'event' | 'lead'
    /** Status próprio do registro (Event.status ou Lead.status). Não define a cor. */
    status: string
    /** Etapa do lead no pipeline — define "fechado" na cor do card. */
    leadStage: string
    /** Dia do calendário ('YYYY-MM-DD'), usado na comparação com "hoje". */
    dateKey: string
    eventType: string
    venue: string | null
    musicians: string[]
  }
}

type EventRow = {
  id: string
  client_name: string
  event_type: string
  event_date: Date
  venue_name: string
  status: string
  lead: { status: string }
  event_musicians: { user: { name: string } | null }[]
}

type LeadRow = {
  id: string
  client_name: string
  event_type: string
  event_date: Date | null
  venue_name: string | null
  status: string
}

/** Monta os itens da Agenda (SSR e /api/agenda) para a mesma regra de cor nos dois caminhos. */
export function buildCalendarItems(events: EventRow[], leads: LeadRow[]): CalendarItemData[] {
  return [
    ...events.map(e => ({
      id:    e.id,
      title: e.client_name,
      start: e.event_date,
      end:   e.event_date,
      resource: {
        kind:      'event' as const,
        status:    e.status,
        leadStage: e.lead.status,
        dateKey:   toDateKey(e.event_date),
        eventType: e.event_type,
        venue:     e.venue_name,
        musicians: e.event_musicians
          .map(em => em.user?.name)
          .filter((n): n is string => n != null),
      },
    })),
    ...leads.map(l => ({
      id:    l.id,
      title: l.client_name,
      start: l.event_date!,
      end:   l.event_date!,
      resource: {
        kind:      'lead' as const,
        status:    l.status,
        leadStage: l.status,
        dateKey:   toDateKey(l.event_date!),
        eventType: l.event_type,
        venue:     l.venue_name ?? null,
        musicians: [] as string[],
      },
    })),
  ]
}
