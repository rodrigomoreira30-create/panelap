import { describe, it, expect } from 'vitest'
import {
  computeEventFinance,
  computeReceivedAmount,
  calcTotals,
  resolveItemAmount,
  type EventFinanceData,
  type FinanceItemData,
  type EventPaymentData,
} from '@/lib/financas'

function item(overrides: Partial<FinanceItemData> = {}): FinanceItemData {
  return {
    id: 'item-1',
    finance_id: 'finance-1',
    category: 'outros',
    label: 'Item',
    amount: 0,
    paid: false,
    notes: null,
    percent_of_revenue: null,
    is_overridden: false,
    event_musician_id: null,
    ...overrides,
  }
}

function payment(overrides: Partial<EventPaymentData> = {}): EventPaymentData {
  return {
    id: 'payment-1',
    finance_id: 'finance-1',
    payment_date: '2026-09-14T00:00:00.000Z',
    amount: 0,
    payment_method: 'PIX',
    notes: null,
    ...overrides,
  }
}

function finance(overrides: Partial<EventFinanceData> = {}): EventFinanceData {
  return {
    id: 'finance-1',
    event_id: 'event-1',
    name: 'Show teste',
    client: null,
    product: null,
    event_date: '2026-09-14T00:00:00.000Z',
    expected_revenue: 0,
    received_amount: 0,
    notes: null,
    items: [],
    payments: [],
    ...overrides,
  }
}

describe('computeEventFinance', () => {
  it('evento sem nada: tudo zero e margem exibida como null (para virar "—" na UI)', () => {
    const totals = computeEventFinance(finance())
    expect(totals.revenueForecast).toBe(0)
    expect(totals.costTotal).toBe(0)
    expect(totals.profit).toBe(0)
    expect(totals.marginPercent).toBeNull()
  })

  it('evento só com receita: lucro igual à receita, margem 100%', () => {
    const totals = computeEventFinance(finance({ expected_revenue: 1000 }))
    expect(totals.profit).toBe(1000)
    expect(totals.marginPercent).toBe(100)
  })

  it('item percentual sem override recalcula a partir da receita prevista', () => {
    const f = finance({
      expected_revenue: 1000,
      items: [item({ category: 'comissao_panel', percent_of_revenue: 10, amount: 999 })],
    })
    const totals = computeEventFinance(f)
    expect(totals.costByCategory.comissao_panel).toBe(100)
    expect(totals.costTotal).toBe(100)
  })

  it('item percentual com override usa o valor gravado manualmente', () => {
    const f = finance({
      expected_revenue: 1000,
      items: [item({ category: 'comissao_panel', percent_of_revenue: 10, amount: 250, is_overridden: true })],
    })
    const totals = computeEventFinance(f)
    expect(totals.costByCategory.comissao_panel).toBe(250)
  })

  it('lucro negativo aparece com sinal', () => {
    const f = finance({
      expected_revenue: 500,
      items: [item({ amount: 800 })],
    })
    const totals = computeEventFinance(f)
    expect(totals.profit).toBe(-300)
    expect(totals.marginPercent).toBe(-60)
  })

  it('recebido acima do previsto deixa "a receber" negativo, sem travar', () => {
    const f = finance({ expected_revenue: 1000, received_amount: 1200 })
    const totals = computeEventFinance(f)
    expect(totals.receivable).toBe(-200)
  })

  it('visão de caixa considera só os custos pagos', () => {
    const f = finance({
      expected_revenue: 1000,
      received_amount: 1000,
      items: [
        item({ id: 'a', amount: 100, paid: true }),
        item({ id: 'b', amount: 300, paid: false }),
      ],
    })
    const totals = computeEventFinance(f)
    expect(totals.cashProfit).toBe(900) // 1000 recebido - 100 pago
    expect(totals.costTotal).toBe(400)  // 100 + 300 previstos
  })

  it('arredonda para 2 casas decimais em percentuais com dízima', () => {
    const f = finance({
      expected_revenue: 100,
      items: [item({ percent_of_revenue: 33.333, amount: 0 })],
    })
    const totals = computeEventFinance(f)
    expect(totals.costTotal).toBe(33.33)
  })

  it('itens em categorias diferentes aparecem separados em costByCategory', () => {
    const f = finance({
      expected_revenue: 1000,
      items: [
        item({ id: 'a', category: 'transporte', amount: 150 }),
        item({ id: 'b', category: 'hospedagem', amount: 200 }),
      ],
    })
    const totals = computeEventFinance(f)
    expect(totals.costByCategory.transporte).toBe(150)
    expect(totals.costByCategory.hospedagem).toBe(200)
    expect(totals.costTotal).toBe(350)
  })
})

describe('computeReceivedAmount', () => {
  it('evento antigo sem recebimentos: preserva o valor histórico de received_amount', () => {
    const f = finance({ received_amount: 4200, payments: [] })
    expect(computeReceivedAmount(f)).toBe(4200)
  })

  it('evento com recebimentos registrados: soma os recebimentos, ignorando o valor legado', () => {
    const f = finance({
      received_amount: 999, // valor legado antigo — não deve ser somado nem usado
      payments: [payment({ amount: 5000 }), payment({ id: 'p2', amount: 3000 }), payment({ id: 'p3', amount: 7000 })],
    })
    expect(computeReceivedAmount(f)).toBe(15000)
  })

  it('exemplo do enunciado: receita 18800, recebimentos 5000+3000+7000 => recebido 15000, a receber 3800', () => {
    const f = finance({
      expected_revenue: 18800,
      received_amount: 0,
      payments: [payment({ amount: 5000 }), payment({ id: 'p2', amount: 3000 }), payment({ id: 'p3', amount: 7000 })],
    })
    const totals = computeEventFinance(f)
    expect(totals.received).toBe(15000)
    expect(totals.receivable).toBe(3800)
  })

  it('um único recebimento também substitui o valor legado (sem duplicar)', () => {
    const f = finance({ received_amount: 500, payments: [payment({ amount: 1000 })] })
    expect(computeReceivedAmount(f)).toBe(1000)
  })
})

describe('inconsistência Evento x Finanças geral — regressão do caso "Antonio"', () => {
  it('Cenário A — evento antigo sem EventPayment: usa received_amount legado', () => {
    const f = finance({ expected_revenue: 10000, received_amount: 5000, payments: [] })
    const totals = computeEventFinance(f)
    expect(totals.received).toBe(5000)
    expect(totals.receivable).toBe(5000)
  })

  it('Cenário B — evento "Antonio": receita 18800, received_amount legado 15000, recebimentos 3800+15000 => recebido 18800, a receber 0', () => {
    const f = finance({
      expected_revenue: 18800,
      received_amount: 15000, // valor legado desatualizado — não deve ser usado nem somado
      payments: [payment({ id: 'p1', amount: 3800 }), payment({ id: 'p2', amount: 15000 })],
    })
    const totals = computeEventFinance(f)
    expect(totals.received).toBe(18800)
    expect(totals.receivable).toBe(0)
  })

  it('Cenário C — calcTotals soma corretamente o "Recebido" de vários eventos do mês (misturando legado e EventPayment)', () => {
    const eventoAntigo = finance({
      id: 'f-antigo', expected_revenue: 10000, received_amount: 5000, payments: [],
    })
    const eventoAntonio = finance({
      id: 'f-antonio', expected_revenue: 18800, received_amount: 15000,
      payments: [payment({ id: 'p1', amount: 3800 }), payment({ id: 'p2', amount: 15000 })],
    })
    const totals = calcTotals([eventoAntigo, eventoAntonio])
    expect(totals.totalReceived).toBe(5000 + 18800)
    expect(totals.totalToReceive).toBe((10000 - 5000) + (18800 - 18800))
  })
})

describe('validação cruzada Financeiro do evento ↔ Financeiro Geral (padronização)', () => {
  it('Cenário 1 — recebimentos 3800+15000 sobre receita 18800: evento e agregado batem em recebido e a receber', () => {
    const f = finance({
      expected_revenue: 18800,
      received_amount: 15000,
      payments: [payment({ id: 'p1', amount: 3800 }), payment({ id: 'p2', amount: 15000 })],
    })
    const evento = computeEventFinance(f)
    const geral = calcTotals([f])
    expect(evento.received).toBe(18800)
    expect(evento.receivable).toBe(0)
    expect(geral.totalReceived).toBe(evento.received)
    expect(geral.totalToReceive).toBe(evento.receivable)
  })

  it('Cenário 2 — adicionar "Outros custos" de R$500 aumenta custos e reduz lucro igualmente no evento e no Financeiro Geral', () => {
    const antes = finance({
      expected_revenue: 10000,
      items: [item({ id: 'outros', category: 'outros', amount: 0 })],
    })
    const depois = finance({
      expected_revenue: 10000,
      items: [item({ id: 'outros', category: 'outros', amount: 500 })],
    })

    const eventoAntes  = computeEventFinance(antes)
    const eventoDepois = computeEventFinance(depois)
    const geralAntes   = calcTotals([antes])
    const geralDepois  = calcTotals([depois])

    expect(eventoDepois.costTotal - eventoAntes.costTotal).toBe(500)
    expect(geralDepois.totalCosts - geralAntes.totalCosts).toBe(500)
    expect(eventoAntes.profit - eventoDepois.profit).toBe(500)
    expect(geralAntes.totalProfit - geralDepois.totalProfit).toBe(500)
    // O Financeiro Geral bate exatamente com o evento, não é uma fórmula paralela
    expect(geralDepois.totalCosts).toBe(eventoDepois.costTotal)
    expect(geralDepois.totalProfit).toBe(eventoDepois.profit)
  })

  it('Cenário 3 — alterar cachê de músico de 500 para 700 aumenta custos em 200 no evento e no Financeiro Geral', () => {
    const antes = finance({
      expected_revenue: 10000,
      items: [item({ id: 'cache-1', category: 'cache_musico', label: 'Bateria — André', amount: 500 })],
    })
    const depois = finance({
      expected_revenue: 10000,
      items: [item({ id: 'cache-1', category: 'cache_musico', label: 'Bateria — André', amount: 700 })],
    })

    const eventoAntes  = computeEventFinance(antes)
    const eventoDepois = computeEventFinance(depois)
    const geralAntes   = calcTotals([antes])
    const geralDepois  = calcTotals([depois])

    expect(eventoDepois.costTotal - eventoAntes.costTotal).toBe(200)
    expect(geralDepois.totalCosts - geralAntes.totalCosts).toBe(200)
    expect(geralDepois.totalCosts).toBe(eventoDepois.costTotal)
    expect(geralDepois.totalProfit).toBe(eventoDepois.profit)
  })

  it('Cenário 4 — evento antigo usando received_amount legado continua correto no evento e no Financeiro Geral', () => {
    const f = finance({ expected_revenue: 10000, received_amount: 4200, payments: [] })
    const evento = computeEventFinance(f)
    const geral = calcTotals([f])
    expect(evento.received).toBe(4200)
    expect(geral.totalReceived).toBe(4200)
  })

  it('Cenário 5 — vários eventos no mês: cards do Financeiro Geral somam exatamente os valores computados de cada evento', () => {
    const eventoA = finance({
      id: 'a', expected_revenue: 10000, received_amount: 5000, payments: [],
      items: [item({ id: 'ia', category: 'outros', amount: 1000 })],
    })
    const eventoB = finance({
      id: 'b', expected_revenue: 18800, received_amount: 15000,
      payments: [payment({ id: 'pb1', amount: 3800 }), payment({ id: 'pb2', amount: 15000 })],
      items: [item({ id: 'ib', category: 'cache_musico', amount: 700 })],
    })

    const totaisA = computeEventFinance(eventoA)
    const totaisB = computeEventFinance(eventoB)
    const geral = calcTotals([eventoA, eventoB])

    expect(geral.totalRevenue).toBe(totaisA.revenueForecast + totaisB.revenueForecast)
    expect(geral.totalReceived).toBe(totaisA.received + totaisB.received)
    expect(geral.totalToReceive).toBe(totaisA.receivable + totaisB.receivable)
    expect(geral.totalCosts).toBe(totaisA.costTotal + totaisB.costTotal)
    expect(geral.totalProfit).toBe(totaisA.profit + totaisB.profit)
  })
})

describe('resolveItemAmount', () => {
  it('sem percentual, retorna o amount gravado', () => {
    expect(resolveItemAmount(item({ amount: 42 }), 1000)).toBe(42)
  })

  it('percent_of_revenue igual a 0 resolve para 0, não cai no amount gravado', () => {
    expect(resolveItemAmount(item({ percent_of_revenue: 0, amount: 500 }), 1000)).toBe(0)
  })
})
