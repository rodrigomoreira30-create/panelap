import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/financas/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findFirst: vi.fn() },
    eventFinance: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/financas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/financas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 422 quando event_id não é enviado', async () => {
    const response = await POST(makeRequest({ name: 'Show avulso' }))
    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.error).toMatch(/event_id/)
  })

  it('cria o financeiro vinculado a um evento existente', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({
      id: 'event-1',
      band_id: 'band-1',
      client_name: 'Casamento Ana',
      event_date: new Date('2026-10-01'),
      lead: { lead_attractions: [], proposal_discount: 0 },
    } as any)
    vi.mocked(prisma.eventFinance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.eventFinance.create).mockResolvedValueOnce({
      id: 'finance-1',
      event_id: 'event-1',
      name: 'Casamento Ana',
      client: 'Casamento Ana',
      product: null,
      event_date: new Date('2026-10-01'),
      expected_revenue: 0,
      received_amount: 0,
      notes: null,
      items: [],
    } as any)

    const response = await POST(makeRequest({ event_id: 'event-1' }))
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.data.event_id).toBe('event-1')
  })
})
