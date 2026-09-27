import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/events/[id]/finance/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/finance-service', () => ({
  getOrCreateEventFinance: vi.fn(),
  reconcileTeamCosts: vi.fn().mockResolvedValue(0),
}))

const params = Promise.resolve({ id: 'event-1' })

describe('GET /api/events/[id]/finance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 404 quando o evento não pertence à banda', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce(null)

    const response = await GET(new Request('http://localhost/api/events/event-1/finance'), { params })
    expect(response.status).toBe(404)
  })

  it('retorna os dados serializados e os totais calculados', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getOrCreateEventFinance } = await import('@/lib/finance-service')

    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({ id: 'event-1', band_id: 'band-1' } as any)
    vi.mocked(getOrCreateEventFinance).mockResolvedValueOnce({
      id: 'finance-1',
      event_id: 'event-1',
      name: 'Show X',
      client: null,
      product: null,
      event_date: new Date('2026-10-01'),
      expected_revenue: { toString: () => '1000' },
      received_amount: { toString: () => '0' },
      notes: null,
      items: [],
    } as any)

    const response = await GET(new Request('http://localhost/api/events/event-1/finance'), { params })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.expected_revenue).toBe(1000)
    expect(json.totals.profit).toBe(1000)
  })

  it('cura a equipe da Formação antes de responder e relê o financeiro quando criou linhas', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getOrCreateEventFinance, reconcileTeamCosts } = await import('@/lib/finance-service')
    const base = {
      id: 'finance-1', event_id: 'event-1', name: 'Show X', client: null, product: null,
      event_date: new Date('2026-10-01'), expected_revenue: { toString: () => '1000' },
      received_amount: { toString: () => '0' }, notes: null,
    }
    const item = (id: string, amount: string, label: string) => ({
      id, finance_id: 'finance-1', category: 'cache_musico', label, amount: { toString: () => amount },
      paid: false, notes: null, percent_of_revenue: null, is_overridden: false, event_musician_id: `em-${id}`,
    })

    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({ id: 'event-1', band_id: 'band-1' } as any)
    vi.mocked(getOrCreateEventFinance)
      .mockResolvedValueOnce({ ...base, items: [item('a', '700', 'Baixo — Wandi')] } as any)
      .mockResolvedValueOnce({ ...base, items: [item('a', '700', 'Baixo — Wandi'), item('b', '600', 'Guitarra — Renanzinho Guita')] } as any)
    vi.mocked(reconcileTeamCosts).mockResolvedValueOnce(1)

    const response = await GET(new Request('http://localhost/api/events/event-1/finance'), { params })
    const json = await response.json()

    expect(reconcileTeamCosts).toHaveBeenCalledWith({ bandId: 'band-1', eventId: 'event-1' })
    expect(json.data.items.map((i: any) => i.label)).toContain('Guitarra — Renanzinho Guita')
    expect(json.totals.costTotal).toBe(1300)
  })

  it('não relê o financeiro quando não havia nada a curar', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getOrCreateEventFinance, reconcileTeamCosts } = await import('@/lib/finance-service')
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({ id: 'event-1', band_id: 'band-1' } as any)
    vi.mocked(getOrCreateEventFinance).mockResolvedValueOnce({
      id: 'finance-1', event_id: 'event-1', name: 'Show X', client: null, product: null,
      event_date: new Date('2026-10-01'), expected_revenue: { toString: () => '1000' },
      received_amount: { toString: () => '0' }, notes: null, items: [],
    } as any)
    vi.mocked(reconcileTeamCosts).mockResolvedValueOnce(0)

    await GET(new Request('http://localhost/api/events/event-1/finance'), { params })

    expect(getOrCreateEventFinance).toHaveBeenCalledTimes(1)
  })
})
