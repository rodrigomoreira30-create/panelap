import { describe, it, expect, vi } from 'vitest'
import { eventBus } from '@/lib/events/internal-bus'

describe('eventBus', () => {
  it('chama listeners quando evento é emitido', () => {
    const handler = vi.fn()
    eventBus.on('lead.closed', handler)
    eventBus.emit('lead.closed', { lead_id: '123', band_id: 'b1' })
    expect(handler).toHaveBeenCalledWith({ lead_id: '123', band_id: 'b1' })
    eventBus.off('lead.closed', handler)
  })

  it('remove listener corretamente com off', () => {
    const handler = vi.fn()
    eventBus.on('lead.closed', handler)
    eventBus.off('lead.closed', handler)
    eventBus.emit('lead.closed', { lead_id: '123', band_id: 'b1' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('suporta múltiplos listeners no mesmo evento', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    eventBus.on('contract.signed', h1)
    eventBus.on('contract.signed', h2)
    eventBus.emit('contract.signed', { contract_id: 'c1' })
    expect(h1).toHaveBeenCalled()
    expect(h2).toHaveBeenCalled()
    eventBus.off('contract.signed', h1)
    eventBus.off('contract.signed', h2)
  })
})
