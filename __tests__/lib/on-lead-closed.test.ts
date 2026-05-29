import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registerLeadClosedContractListener } from '@/lib/contracts/on-lead-closed'

vi.mock('@/lib/claude/agents/contracts-agent', () => ({
  runContractsAgent: vi.fn(),
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

  it('calls runContractsAgent with lead_id and band_id', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { runContractsAgent } = await import('@/lib/claude/agents/contracts-agent')

    vi.mocked(runContractsAgent).mockResolvedValue(undefined)

    registerLeadClosedContractListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await handler({ lead_id: 'lead-1', band_id: 'band-1' })

    expect(runContractsAgent).toHaveBeenCalledWith({
      lead_id: 'lead-1',
      band_id: 'band-1',
    })
  })

  it('does not throw when runContractsAgent rejects', async () => {
    const { eventBus } = await import('@/lib/events/internal-bus')
    const { runContractsAgent } = await import('@/lib/claude/agents/contracts-agent')

    vi.mocked(runContractsAgent).mockRejectedValue(new Error('agent failure'))

    registerLeadClosedContractListener()

    const handler = vi.mocked(eventBus.on).mock.calls[0]?.[1] as Function
    await expect(handler({ lead_id: 'lead-1', band_id: 'band-1' })).resolves.toBeUndefined()
  })
})
