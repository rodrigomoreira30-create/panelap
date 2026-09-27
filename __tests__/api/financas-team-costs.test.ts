import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/financas/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { eventFinance: { findMany: vi.fn() } },
}))

vi.mock('@/lib/finance-service', () => ({
  reconcileTeamCosts: vi.fn().mockResolvedValue(0),
}))

describe('GET /api/financas — Financeiro Geral reflete a equipe da Formação', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cura a equipe da banda antes de ler os custos do mês', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { reconcileTeamCosts } = await import('@/lib/finance-service')
    vi.mocked(prisma.eventFinance.findMany).mockResolvedValueOnce([] as any)

    const response = await GET(new Request('http://localhost/api/financas?month=9&year=2026'))

    expect(response.status).toBe(200)
    expect(reconcileTeamCosts).toHaveBeenCalledWith({ bandId: 'band-1' })
    const reconcileOrder = vi.mocked(reconcileTeamCosts).mock.invocationCallOrder[0]
    const findManyOrder = vi.mocked(prisma.eventFinance.findMany).mock.invocationCallOrder[0]
    expect(reconcileOrder).toBeLessThan(findManyOrder)
  })
})
