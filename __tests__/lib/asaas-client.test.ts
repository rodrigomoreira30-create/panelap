import { describe, it, expect } from 'vitest'
import { buildSubscriptionPayload } from '@/lib/asaas/client'

describe('buildSubscriptionPayload', () => {
  it('monta payload de assinatura mensal corretamente', () => {
    const payload = buildSubscriptionPayload({
      customer_id: 'cus_abc123',
      plan:        'starter',
      band_name:   'Banda Rock',
    })

    expect(payload.customer).toBe('cus_abc123')
    expect(payload.billingType).toBe('UNDEFINED')
    expect(payload.cycle).toBe('MONTHLY')
    expect(typeof payload.value).toBe('number')
    expect(payload.value).toBeGreaterThan(0)
    expect(typeof payload.nextDueDate).toBe('string')
    expect(payload.description).toContain('Banda Rock')
  })

  it('aplica valor correto por plano', () => {
    const starter    = buildSubscriptionPayload({ customer_id: 'c1', plan: 'starter',    band_name: 'B' })
    const pro        = buildSubscriptionPayload({ customer_id: 'c1', plan: 'pro',        band_name: 'B' })
    const enterprise = buildSubscriptionPayload({ customer_id: 'c1', plan: 'enterprise', band_name: 'B' })

    expect(starter.value).toBeLessThan(pro.value)
    expect(pro.value).toBeLessThan(enterprise.value)
  })
})
