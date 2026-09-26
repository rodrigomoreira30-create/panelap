import { describe, it, expect } from 'vitest'
import { buildCalendarItems } from '@/lib/agenda/calendar-items'

const eventRow = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  client_name: 'Helena e João Pedro',
  event_type: 'wedding',
  event_date: new Date('2026-09-26T00:00:00.000Z'),
  venue_name: 'Espaço X',
  status: 'done', // "Equipe OK" — não deve ser o critério de cor
  lead: { status: 'closed' },
  event_musicians: [{ user: { name: 'Ana' } }, { user: null }],
  ...over,
})

const leadRow = (over: Record<string, unknown> = {}) => ({
  id: 'lead-1',
  client_name: 'Siemens',
  event_type: 'corporate',
  event_date: new Date('2026-12-11T00:00:00.000Z'),
  venue_name: null,
  status: 'new_lead',
  ...over,
})

describe('buildCalendarItems', () => {
  it('evento carrega a etapa do lead (leadStage) e o dia do calendário (dateKey)', () => {
    const [item] = buildCalendarItems([eventRow()] as any, [])
    expect(item.resource.kind).toBe('event')
    expect(item.resource.leadStage).toBe('closed')
    expect(item.resource.dateKey).toBe('2026-09-26')
    expect(item.resource.status).toBe('done')
    expect(item.resource.musicians).toEqual(['Ana'])
  })

  it('lead aberto usa o próprio status como leadStage', () => {
    const [item] = buildCalendarItems([], [leadRow()] as any)
    expect(item.resource.kind).toBe('lead')
    expect(item.resource.leadStage).toBe('new_lead')
    expect(item.resource.dateKey).toBe('2026-12-11')
  })

  it('mantém eventos antes dos leads', () => {
    const items = buildCalendarItems([eventRow()] as any, [leadRow()] as any)
    expect(items.map(i => i.resource.kind)).toEqual(['event', 'lead'])
  })
})
