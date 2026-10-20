import { describe, it, expect } from 'vitest'
import {
  toISODate,
  resolvePresetRange,
  parsePeriodRange,
  pickGranularity,
  buildBuckets,
  bucketKeyFor,
  formatPeriodLabel,
  summarizeEventFinances,
  buildFinanceEvolution,
  summarizePayments,
  countByBucket,
} from '@/lib/dashboard-period'
import { calcTotals, round2, type EventFinanceData } from '@/lib/financas'

// 15/10/2026, 14:30 em Brasília (17:30 UTC)
const TODAY = new Date('2026-10-15T17:30:00.000Z')
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

function finance(overrides: Partial<EventFinanceData> = {}): EventFinanceData {
  return {
    id: 'f1', event_id: 'e1', name: 'Show', client: null, product: null,
    event_date: utc(2026, 0, 10).toISOString(),
    expected_revenue: 10000, received_amount: 0, notes: null,
    items: [], payments: [],
    ...overrides,
  }
}

function item(category: string, amount: number, extra: Record<string, unknown> = {}) {
  return {
    id: `i-${category}-${amount}`, finance_id: 'f1', category, label: category, amount,
    paid: false, notes: null, percent_of_revenue: null, is_overridden: false,
    event_musician_id: null, ...extra,
  }
}

function payment(date: Date, amount: number) {
  return {
    id: `p-${amount}`, finance_id: 'f1', payment_date: date.toISOString(), amount,
    payment_method: 'pix', notes: null,
  }
}

describe('resolvePresetRange', () => {
  it('usa o dia corrente de Brasília, não o do servidor', () => {
    // 01/11/2026 01:00 UTC = 31/10/2026 22:00 em Brasília
    expect(resolvePresetRange('month', new Date('2026-11-01T01:00:00Z'))).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })
  it('7 dias termina hoje e inclui 7 dias', () => {
    expect(resolvePresetRange('7d', TODAY)).toEqual({ from: '2026-10-09', to: '2026-10-15' })
  })
  it('30 dias', () => {
    expect(resolvePresetRange('30d', TODAY)).toEqual({ from: '2026-09-16', to: '2026-10-15' })
  })
  it('90 dias', () => {
    expect(resolvePresetRange('90d', TODAY)).toEqual({ from: '2026-07-18', to: '2026-10-15' })
  })
  it('este mês cobre o mês inteiro (igual ao Financeiro Geral)', () => {
    expect(resolvePresetRange('month', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })
  it('este ano cobre de janeiro a dezembro', () => {
    expect(resolvePresetRange('year', TODAY)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
})

describe('parsePeriodRange', () => {
  it('datas civis (event_date/payment_date): primeiro e último dia inteiros, sem depender do fuso do servidor', () => {
    const r = parsePeriodRange('2025-01-01', '2025-12-31')
    if ('error' in r) throw new Error(r.error)
    expect(r.start.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    expect(r.end.toISOString()).toBe('2025-12-31T23:59:59.999Z')
  })
  it('instantes reais (created_at): limites no fuso de Brasília', () => {
    const r = parsePeriodRange('2026-10-01', '2026-11-30')
    if ('error' in r) throw new Error(r.error)
    expect(r.instantStart.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(r.instantEnd.toISOString()).toBe('2026-12-01T02:59:59.999Z')
  })
  it('aceita intervalo entre anos diferentes', () => {
    const r = parsePeriodRange('2025-11-01', '2027-06-30')
    expect('error' in r).toBe(false)
  })
  it('rejeita data inválida', () => {
    expect(parsePeriodRange('2025-02-30', '2025-03-01')).toHaveProperty('error')
    expect(parsePeriodRange('abc', '2025-03-01')).toHaveProperty('error')
  })
  it('rejeita data inicial depois da final', () => {
    expect(parsePeriodRange('2026-05-01', '2026-04-01')).toHaveProperty('error')
  })
  it('rejeita intervalos acima de 10 anos', () => {
    expect(parsePeriodRange('2010-01-01', '2026-01-01')).toHaveProperty('error')
  })
})

describe('pickGranularity / buildBuckets', () => {
  it('até 31 dias agrupa por dia', () => {
    const r = parsePeriodRange('2026-10-01', '2026-10-31')
    if ('error' in r) throw new Error()
    expect(pickGranularity(r.start, r.end)).toBe('day')
    const buckets = buildBuckets(r.start, r.end, 'day')
    expect(buckets).toHaveLength(31)
    expect(buckets[0]).toEqual({ key: '2026-10-01', label: '01/10' })
  })
  it('90 dias agrupa por semana (segunda-feira)', () => {
    const r = parsePeriodRange('2026-07-18', '2026-10-15')
    if ('error' in r) throw new Error()
    expect(pickGranularity(r.start, r.end)).toBe('week')
    const buckets = buildBuckets(r.start, r.end, 'week')
    // 18/07/2026 é sábado → semana começa em 13/07; rótulo usa o início efetivo do período
    expect(buckets[0]).toEqual({ key: '2026-07-13', label: '18/07' })
    expect(buckets).toHaveLength(14)
    expect(buckets[buckets.length - 1].key).toBe('2026-10-12')
  })
  it('um ano agrupa por mês', () => {
    const r = parsePeriodRange('2026-01-01', '2026-12-31')
    if ('error' in r) throw new Error()
    expect(pickGranularity(r.start, r.end)).toBe('month')
    const buckets = buildBuckets(r.start, r.end, 'month')
    expect(buckets).toHaveLength(12)
    expect(buckets[0]).toEqual({ key: '2026-01', label: 'jan/26' })
    expect(buckets[11]).toEqual({ key: '2026-12', label: 'dez/26' })
  })
  it('bucketKeyFor é coerente com as chaves geradas', () => {
    expect(bucketKeyFor(utc(2026, 6, 19), 'week')).toBe('2026-07-13')
    expect(bucketKeyFor(utc(2026, 6, 19), 'month')).toBe('2026-07')
    expect(bucketKeyFor(utc(2026, 6, 19), 'day')).toBe('2026-07-19')
  })
})

describe('formatPeriodLabel / toISODate', () => {
  it('usa DD/MM/AAAA', () => {
    expect(formatPeriodLabel('2026-01-01', '2026-12-31')).toBe('01/01/2026 a 31/12/2026')
    expect(toISODate(utc(2026, 1, 5))).toBe('2026-02-05')
  })
})

describe('summarizeEventFinances', () => {
  it('período sem eventos: tudo zero e margem nula (sem divisão por zero)', () => {
    const s = summarizeEventFinances([])
    expect(s).toMatchObject({
      faturamentoPrevisto: 0, recebido: 0, aReceber: 0, custos: 0,
      lucroPrevisto: 0, margemPrevista: null, eventos: 0,
      cancelados: { count: 0, faturamentoPrevisto: 0 },
    })
  })

  it('soma todos os custos: cachês, som, operacionais, outros, personalizados e percentuais', () => {
    const f = finance({
      expected_revenue: 20000,
      items: [
        item('cache_musico', 1500),
        item('equipe_som', 2500),
        item('transporte', 300),
        item('outros', 200),
        item('custo_personalizado_xyz', 100),
        // 10% da receita prevista (não sobrescrito) → 2000, igual ao Financeiro Geral
        item('comissao_panel', 0, { percent_of_revenue: 10 }),
      ],
    })
    const s = summarizeEventFinances([f])
    expect(s.custos).toBe(6600)
    expect(s.lucroPrevisto).toBe(13400)
    expect(s.margemPrevista).toBe(67)
  })

  it('pagamentos parciais: recebido pelo histórico, sem somar o valor legado junto', () => {
    const f = finance({
      expected_revenue: 10000,
      received_amount: 9999, // legado ignorado quando há pagamentos registrados
      payments: [payment(utc(2026, 0, 2), 3000), payment(utc(2026, 0, 5), 1500)],
    })
    const s = summarizeEventFinances([f])
    expect(s.recebido).toBe(4500)
    expect(s.aReceber).toBe(5500)
  })

  it('bate exatamente com calcTotals do Financeiro Geral', () => {
    const list = [
      finance({ id: 'a', expected_revenue: 8000, items: [item('cache_musico', 1000)], received_amount: 2000 }),
      finance({ id: 'b', expected_revenue: 12000, items: [item('equipe_som', 3000)], payments: [payment(new Date(), 6000)] }),
    ]
    const s = summarizeEventFinances(list)
    const t = calcTotals(list)
    expect(s.faturamentoPrevisto).toBe(t.totalRevenue)
    expect(s.recebido).toBe(t.totalReceived)
    expect(s.aReceber).toBe(t.totalToReceive)
    expect(s.custos).toBe(t.totalCosts)
    expect(s.lucroPrevisto).toBe(t.totalProfit)
  })

  it('cancelados entram nos totais (paridade com o Financeiro Geral) e são contabilizados à parte', () => {
    const list = [
      { ...finance({ id: 'a', expected_revenue: 8000 }), cancelled: false },
      { ...finance({ id: 'b', expected_revenue: 5000 }), cancelled: true },
    ]
    const s = summarizeEventFinances(list)
    expect(s.faturamentoPrevisto).toBe(13000)
    expect(s.eventos).toBe(2)
    expect(s.cancelados).toEqual({ count: 1, faturamentoPrevisto: 5000 })
  })

  it('percentual recebido = recebido ÷ receita prevista; nulo sem receita', () => {
    const s = summarizeEventFinances([finance({ expected_revenue: 8000, received_amount: 2000 })])
    expect(s.percentualRecebido).toBe(25)
    expect(summarizeEventFinances([]).percentualRecebido).toBeNull()
    expect(summarizeEventFinances([finance({ expected_revenue: 0 })]).percentualRecebido).toBeNull()
  })

  it('período de dois meses = soma exata dos dois meses no Financeiro Geral', () => {
    const out = finance({ id: 'o1', expected_revenue: 50000, received_amount: 30000, items: [item('cache_musico', 20000)] })
    const out2 = finance({ id: 'o2', expected_revenue: 60915, payments: [payment(utc(2026, 5, 1), 39495)], items: [item('equipe_som', 52900)] })
    const nov = finance({ id: 'n1', expected_revenue: 89050, received_amount: 21715, items: [item('outros', 64400)] })
    const october = calcTotals([out, out2])
    const november = calcTotals([nov])
    const both = summarizeEventFinances([out, out2, nov])
    expect(both.faturamentoPrevisto).toBe(round2(october.totalRevenue + november.totalRevenue))
    expect(both.recebido).toBe(round2(october.totalReceived + november.totalReceived))
    expect(both.aReceber).toBe(round2(october.totalToReceive + november.totalToReceive))
    expect(both.custos).toBe(round2(october.totalCosts + november.totalCosts))
    expect(both.lucroPrevisto).toBe(round2(october.totalProfit + november.totalProfit))
  })

  it('margem pode ser negativa', () => {
    const s = summarizeEventFinances([finance({ expected_revenue: 1000, items: [item('outros', 1500)] })])
    expect(s.lucroPrevisto).toBe(-500)
    expect(s.margemPrevista).toBe(-50)
  })
})

describe('buildFinanceEvolution', () => {
  it('agrupa faturamento, custos e lucro por mês usando o cálculo do Financeiro Geral', () => {
    const r = parsePeriodRange('2026-01-01', '2026-12-31')
    if ('error' in r) throw new Error()
    const buckets = buildBuckets(r.start, r.end, 'month')
    const list = [
      finance({ id: 'a', event_date: utc(2026, 0, 10).toISOString(), expected_revenue: 10000, items: [item('outros', 2000)] }),
      finance({ id: 'b', event_date: utc(2026, 0, 25).toISOString(), expected_revenue: 5000, items: [item('outros', 1000)] }),
      finance({ id: 'c', event_date: utc(2026, 2, 3).toISOString(), expected_revenue: 7000, items: [] }),
    ]
    const evo = buildFinanceEvolution(list, buckets, 'month')
    expect(evo).toHaveLength(12)
    expect(evo[0]).toEqual({ key: '2026-01', label: 'jan/26', faturamento: 15000, custos: 3000, lucro: 12000 })
    expect(evo[1]).toEqual({ key: '2026-02', label: 'fev/26', faturamento: 0, custos: 0, lucro: 0 })
    expect(evo[2].faturamento).toBe(7000)
  })
})

describe('summarizePayments', () => {
  it('soma pela data real do recebimento e agrupa por intervalo', () => {
    const r = parsePeriodRange('2026-01-01', '2026-12-31')
    if ('error' in r) throw new Error()
    const buckets = buildBuckets(r.start, r.end, 'month')
    const s = summarizePayments(
      [
        { finance_id: 'a', payment_date: utc(2026, 0, 5), amount: 1000 },
        { finance_id: 'a', payment_date: utc(2026, 3, 5), amount: 2500.5 },
        { finance_id: 'b', payment_date: utc(2026, 3, 9), amount: 500 },
      ],
      buckets,
      'month',
    )
    expect(s.recebido).toBe(4000.5)
    expect(s.pagamentos).toBe(3)
    expect(s.eventos).toBe(2)
    expect(s.evolution[0]).toEqual({ key: '2026-01', label: 'jan/26', recebido: 1000 })
    expect(s.evolution[3].recebido).toBe(3000.5)
  })
})

describe('countByBucket', () => {
  it('conta instantes pelo dia civil de Brasília, com zeros', () => {
    const r = parsePeriodRange('2026-10-09', '2026-10-15')
    if ('error' in r) throw new Error()
    const buckets = buildBuckets(r.start, r.end, 'day')
    const out = countByBucket(
      [
        new Date('2026-10-09T10:00:00Z'),
        // 23:30 de 09/10 em Brasília = 02:30 UTC de 10/10 → conta no dia 09
        new Date('2026-10-10T02:30:00Z'),
        new Date('2026-10-15T12:00:00Z'),
      ],
      buckets,
      'day',
    )
    expect(out.map(o => o.count)).toEqual([2, 0, 0, 0, 0, 0, 1])
  })
})
