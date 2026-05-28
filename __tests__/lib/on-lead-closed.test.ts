import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registerLeadClosedContractListener } from '@/lib/contracts/on-lead-closed'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    contractTemplate: { findFirst: vi.fn() },
    contract: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/events/internal-bus', () => ({
  eventBus: {
    on: vi.fn(),
    emit: vi.fn(),
  },
}))

describe('registerLeadClosedContractListener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers listener on eventBus with lead.closed event', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')

    registerLeadClosedContractListener()

    expect(vi.mocked(eventBus.on)).toHaveBeenCalledWith(
      'lead.closed',
      expect.any(Function)
    )
  })

  it('creates contract when event and default template exist', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: 'event-1' } as any)
    vi.mocked(prisma.contractTemplate.findFirst).mockResolvedValue({ id: 'template-1' } as any)
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.contract.create).mockResolvedValue({ id: 'contract-1' } as any)

    registerLeadClosedContractListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(prisma.contract.create).toHaveBeenCalledWith({
      data: {
        event_id: 'event-1',
        template_id: 'template-1',
        status: 'draft',
      },
    })
  })

  it('does not create contract when event not found', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

    registerLeadClosedContractListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(prisma.contract.create).not.toHaveBeenCalled()
  })

  it('does not create contract when no default template', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: 'event-1' } as any)
    vi.mocked(prisma.contractTemplate.findFirst).mockResolvedValue(null)

    registerLeadClosedContractListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(prisma.contract.create).not.toHaveBeenCalled()
  })

  it('does not create duplicate contract when one already exists', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: 'event-1' } as any)
    vi.mocked(prisma.contractTemplate.findFirst).mockResolvedValue({ id: 'template-1' } as any)
    vi.mocked(prisma.contract.findFirst).mockResolvedValue({ id: 'existing-contract' } as any)

    registerLeadClosedContractListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(prisma.contract.create).not.toHaveBeenCalled()
  })
})
