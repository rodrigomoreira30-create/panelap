import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registerProductionLeadClosedListener } from '@/lib/production/on-lead-closed'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lead: { findUnique: vi.fn() },
    event: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    checklist: { create: vi.fn() },
  },
}))

vi.mock('@/lib/events/internal-bus', () => ({
  eventBus: {
    on: vi.fn(),
    emit: vi.fn(),
  },
}))

vi.mock('@/lib/production/default-checklists', () => ({
  getDefaultChecklist: vi.fn().mockReturnValue([
    { description: 'Item 1' },
    { description: 'Item 2' },
  ]),
}))

describe('registerProductionLeadClosedListener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers listener on eventBus with lead.closed event', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')

    registerProductionLeadClosedListener()

    expect(vi.mocked(eventBus.on)).toHaveBeenCalledWith(
      'lead.closed',
      expect.any(Function)
    )
  })

  it('creates event and checklist for lead with event_date', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { prisma } = await import('@/lib/prisma')

    const mockLead = {
      id: 'lead-1',
      client_name: 'Rodrigo',
      event_type: 'wedding',
      event_date: new Date('2026-12-01'),
      venue_name: 'Salão Nobre',
      city: 'São Paulo',
      venue_has_sound: true,
      venue_has_light: false,
      budget: 5000,
      observations: 'Nenhuma',
    }

    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockLead as any)
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.event.create).mockResolvedValue({ id: 'event-1' } as any)
    vi.mocked(prisma.checklist.create).mockResolvedValue({ id: 'checklist-1' } as any)

    registerProductionLeadClosedListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          band_id: 'band-1',
          lead_id: 'lead-1',
          client_name: 'Rodrigo',
        }),
      })
    )
    expect(prisma.checklist.create).toHaveBeenCalled()
  })

  it('does not create event when lead not found', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null)

    registerProductionLeadClosedListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(prisma.event.create).not.toHaveBeenCalled()
  })

  it('does not create event when event already exists', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { prisma } = await import('@/lib/prisma')

    const mockLead = {
      id: 'lead-1',
      client_name: 'Rodrigo',
      event_type: 'wedding',
      event_date: new Date('2026-12-01'),
      venue_name: 'Salão Nobre',
      city: 'São Paulo',
      venue_has_sound: true,
      venue_has_light: false,
      budget: 5000,
      observations: null,
    }

    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockLead as any)
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: 'event-existing' } as any)

    registerProductionLeadClosedListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(prisma.event.create).not.toHaveBeenCalled()
  })

  it('does not create event when lead has no event_date', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { prisma } = await import('@/lib/prisma')

    const mockLead = {
      id: 'lead-1',
      client_name: 'Rodrigo',
      event_type: 'wedding',
      event_date: null,
      venue_name: 'Salão Nobre',
      city: null,
      venue_has_sound: false,
      venue_has_light: false,
      budget: null,
      observations: null,
    }

    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockLead as any)
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

    registerProductionLeadClosedListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(prisma.event.create).not.toHaveBeenCalled()
  })
})
