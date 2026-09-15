import { describe, it, expect } from 'vitest'
import { computeEventFinance, resolveItemAmount, type EventFinanceData, type FinanceItemData } from '@/lib/financas'

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

describe('resolveItemAmount', () => {
  it('sem percentual, retorna o amount gravado', () => {
    expect(resolveItemAmount(item({ amount: 42 }), 1000)).toBe(42)
  })

  it('percent_of_revenue igual a 0 resolve para 0, não cai no amount gravado', () => {
    expect(resolveItemAmount(item({ percent_of_revenue: 0, amount: 500 }), 1000)).toBe(0)
  })
})
