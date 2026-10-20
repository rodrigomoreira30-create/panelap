import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/dashboard/route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'sup-1' } } }) },
  }),
}))

vi.mock('@/lib/finance-service', () => ({
  reconcileTeamCosts: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    lead: { count: vi.fn(), findMany: vi.fn() },
    event: { findMany: vi.fn() },
    eventFinance: { findMany: vi.fn(), aggregate: vi.fn() },
    eventPayment: { findMany: vi.fn() },
  },
}))

function req(query: string) {
  return new Request(`http://localhost:3000/api/dashboard?bandSlug=sapo&${query}`)
}

// Consulta do período (a única que carrega itens de custo); a outra é o "A receber 30 dias".
async function periodFinanceCalls() {
  const { prisma } = await import('@/lib/prisma')
  return vi.mocked(prisma.eventFinance.findMany).mock.calls.filter(c => (c[0] as any)?.include?.items)
}

function financeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1', event_id: 'e1', name: 'Show', client: null, product: null,
    event_date: new Date(2026, 2, 10), expected_revenue: 10000, received_amount: 0, notes: null,
    items: [], payments: [], event: { cancelled_at: null },
    ...overrides,
  }
}

describe('GET /api/dashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      band: { id: 'band-1', slug: 'sapo', pipeline_stages: [] },
    } as any)
    vi.mocked(prisma.lead.count).mockResolvedValue(4)
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      { created_at: new Date(2026, 0, 5), status: 'new_lead' },
      { created_at: new Date(2026, 0, 20), status: 'closed' },
      { created_at: new Date(2026, 4, 2), status: 'new_lead' },
    ] as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([])
    vi.mocked(prisma.eventFinance.findMany).mockResolvedValue([])
    vi.mocked(prisma.eventPayment.findMany).mockResolvedValue([])
    vi.mocked(prisma.eventFinance.aggregate).mockResolvedValue({
      _count: { _all: 0 }, _sum: { received_amount: null },
    } as any)
  })

  it('rejeita período inválido com 400', async () => {
    const res = await GET(req('from=2026-05-01&to=2026-04-01'))
    expect(res.status).toBe(400)
  })

  it('consulta eventos financeiros pela data do evento dentro do intervalo, de qualquer ano', async () => {
    const res = await GET(req('from=2025-01-01&to=2025-12-31'))
    expect(res.status).toBe(200)
    const calls = await periodFinanceCalls()
    expect(calls).toHaveLength(1)
    const where = calls[0][0]!.where as any
    expect(where.band_id).toBe('band-1')
    expect(where.event_date.gte).toEqual(new Date(2025, 0, 1))
    expect(where.event_date.lte).toEqual(new Date(2025, 11, 31, 23, 59, 59, 999))
    const json = await res.json()
    expect(json.data.period).toMatchObject({ from: '2025-01-01', to: '2025-12-31', granularity: 'month', criterion: 'evento' })
  })

  it('leads novos, por período e por etapa usam a data de criação no intervalo', async () => {
    const { prisma } = await import('@/lib/prisma')
    const res = await GET(req('from=2026-01-01&to=2026-12-31'))
    const json = await res.json()
    const where = vi.mocked(prisma.lead.findMany).mock.calls[0][0]!.where as any
    expect(where.created_at.gte).toEqual(new Date(2026, 0, 1))
    expect(json.data.kpi.leadsNovos).toBe(3)
    expect(json.data.kpi.leadsAbertos).toBe(4) // indicador atual, não depende do período
    expect(json.data.leadsByPeriod).toHaveLength(12)
    expect(json.data.leadsByPeriod[0].count).toBe(2)
    const stage = (k: string) => json.data.leadsByStage.find((s: any) => s.stage === k)?.count
    expect(stage('Novo Lead')).toBe(2)
    expect(stage('Fechado')).toBe(1)
  })

  it('critério data do evento: indicadores pelo cálculo do Financeiro Geral, cancelados incluídos e sinalizados', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinance.findMany).mockResolvedValue([
      financeRow({
        id: 'a', expected_revenue: 20000,
        items: [{ id: 'i1', finance_id: 'a', category: 'cache_musico', label: 'Baixo', amount: 1500, paid: false, notes: null, percent_of_revenue: null, is_overridden: false, event_musician_id: 'em1' }],
        payments: [{ id: 'p1', finance_id: 'a', payment_date: new Date(2026, 1, 1), amount: 5000, payment_method: 'pix', notes: null }],
      }),
      financeRow({ id: 'b', expected_revenue: 3000, event: { cancelled_at: new Date() } }),
    ] as any)

    const res = await GET(req('from=2026-01-01&to=2026-12-31&criterio=evento'))
    const json = await res.json()
    expect(json.data.finance).toMatchObject({
      criterion: 'evento',
      faturamentoPrevisto: 23000,
      recebido: 5000,
      aReceber: 18000,
      custos: 1500,
      lucroPrevisto: 21500,
      eventos: 2,
      cancelados: { count: 1, faturamentoPrevisto: 3000 },
    })
    expect(json.data.finance.margemPrevista).toBeCloseTo(93.48, 2)
    expect(json.data.financeEvolution[2]).toMatchObject({ label: 'mar/26', faturamento: 23000, custos: 1500, lucro: 21500 })
    expect(prisma.eventPayment.findMany).not.toHaveBeenCalled()
  })

  it('critério data do recebimento: usa apenas pagamentos com data real e informa valores legados sem data', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventPayment.findMany).mockResolvedValue([
      { finance_id: 'a', payment_date: new Date(2026, 0, 15), amount: 1000 },
      { finance_id: 'b', payment_date: new Date(2026, 6, 1), amount: 2500 },
    ] as any)
    vi.mocked(prisma.eventFinance.aggregate).mockResolvedValue({
      _count: { _all: 2 }, _sum: { received_amount: 4200 },
    } as any)

    const res = await GET(req('from=2026-01-01&to=2026-12-31&criterio=recebimento'))
    const json = await res.json()
    const where = vi.mocked(prisma.eventPayment.findMany).mock.calls[0][0]!.where as any
    expect(where.payment_date.gte).toEqual(new Date(2026, 0, 1))
    expect(where.finance.band_id).toBe('band-1')
    expect(json.data.finance).toEqual({
      criterion: 'recebimento',
      recebido: 3500,
      pagamentos: 2,
      eventos: 2,
      semData: { count: 2, valor: 4200 },
    })
    expect(json.data.financeEvolution[0]).toMatchObject({ label: 'jan/26', recebido: 1000 })
    expect(await periodFinanceCalls()).toHaveLength(0)
  })

  it('período sem eventos retorna zeros e margem nula', async () => {
    const res = await GET(req('from=2030-01-01&to=2030-01-31'))
    const json = await res.json()
    expect(json.data.finance).toMatchObject({ faturamentoPrevisto: 0, custos: 0, lucroPrevisto: 0, margemPrevista: null, eventos: 0 })
    expect(json.data.period.granularity).toBe('day')
  })

  it('mantém compatibilidade com o parâmetro days', async () => {
    const res = await GET(req('days=7'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.leadsByPeriod).toHaveLength(7)
  })
})
