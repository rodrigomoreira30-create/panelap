import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PATCH } from '@/app/api/financas/[id]/items/[itemId]/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    eventFinanceItem: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/financas/finance-1/items/item-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'finance-1', itemId: 'item-1' })

describe('PATCH /api/financas/[id]/items/[itemId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('definir percent_of_revenue recalcula amount e desliga o override', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinanceItem.findUnique).mockResolvedValueOnce({
      id: 'item-1',
      finance_id: 'finance-1',
      amount: { toString: () => '0' },
      percent_of_revenue: null,
      finance: { band_id: 'band-1', expected_revenue: { toString: () => '1000' } },
    } as any)
    vi.mocked(prisma.eventFinanceItem.update).mockImplementationOnce(async ({ data }: any) => ({
      id: 'item-1',
      amount: { toString: () => String(data.amount) },
      percent_of_revenue: { toString: () => String(data.percent_of_revenue) },
      is_overridden: data.is_overridden,
    } as any))

    const response = await PATCH(makeRequest({ percent_of_revenue: 10 }), { params })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.amount).toBe(100)
    expect(json.data.is_overridden).toBe(false)
  })

  it('editar amount manualmente com percentual já definido liga o override', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinanceItem.findUnique).mockResolvedValueOnce({
      id: 'item-1',
      finance_id: 'finance-1',
      amount: { toString: () => '100' },
      percent_of_revenue: { toString: () => '10' },
      finance: { band_id: 'band-1', expected_revenue: { toString: () => '1000' } },
    } as any)
    vi.mocked(prisma.eventFinanceItem.update).mockImplementationOnce(async ({ data }: any) => ({
      id: 'item-1',
      amount: { toString: () => String(data.amount) },
      percent_of_revenue: { toString: () => '10' },
      is_overridden: data.is_overridden,
    } as any))

    const response = await PATCH(makeRequest({ amount: 250 }), { params })
    const json = await response.json()
    expect(json.data.amount).toBe(250)
    expect(json.data.is_overridden).toBe(true)
  })
})
