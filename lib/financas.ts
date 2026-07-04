// lib/financas.ts

export type FinanceItemData = {
  id: string
  finance_id: string
  category: string
  label: string
  amount: number
  paid: boolean
  notes: string | null
}

export type EventFinanceData = {
  id: string
  event_id: string | null
  name: string
  client: string | null
  product: string | null
  event_date: string
  expected_revenue: number
  received_amount: number
  notes: string | null
  items: FinanceItemData[]
}

export const DEFAULT_FINANCE_ITEMS: { category: string; label: string }[] = [
  { category: 'pro_labore',        label: 'Pró-labore' },
  { category: 'comissao_panel',    label: 'Comissão Panel' },
  { category: 'comissao_vendedor', label: 'Comissão vendedor' },
  { category: 'nota_fiscal',       label: 'Nota fiscal' },
  { category: 'visita_tecnica',    label: 'Visita técnica' },
  { category: 'bv_cerimonial',     label: 'BV cerimonial' },
  { category: 'alimentacao_extra', label: 'Alimentação extra' },
  { category: 'transporte',        label: 'Transporte' },
  { category: 'hospedagem',        label: 'Hospedagem' },
  { category: 'cantor_1',          label: 'Cantor 1' },
  { category: 'cantor_2',          label: 'Cantor 2' },
  { category: 'cantor_3',          label: 'Cantor 3' },
  { category: 'cantor_4',          label: 'Cantor 4' },
  { category: 'guitarrista',       label: 'Guitarrista' },
  { category: 'baixista',          label: 'Baixista' },
  { category: 'baterista',         label: 'Bateria' },
  { category: 'tecladista',        label: 'Teclado' },
  { category: 'percussao',         label: 'Percussão' },
  { category: 'sanfoneiro',        label: 'Sanfoneiro' },
  { category: 'dj',                label: 'DJ' },
  { category: 'tecnico_som',       label: 'Técnico de som' },
  { category: 'tecnico_luz',       label: 'Técnico de luz' },
  { category: 'outros',            label: 'Outros custos' },
]

export function serializeFinance(f: any): EventFinanceData {
  return {
    id:               f.id,
    event_id:         f.event_id ?? null,
    name:             f.name,
    client:           f.client ?? null,
    product:          f.product ?? null,
    event_date:       f.event_date instanceof Date ? f.event_date.toISOString() : f.event_date,
    expected_revenue: parseFloat(f.expected_revenue.toString()),
    received_amount:  parseFloat(f.received_amount.toString()),
    notes:            f.notes ?? null,
    items: (f.items ?? []).map((i: any) => ({
      id:         i.id,
      finance_id: i.finance_id,
      category:   i.category,
      label:      i.label,
      amount:     parseFloat(i.amount.toString()),
      paid:       i.paid,
      notes:      i.notes ?? null,
    })),
  }
}

export function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function calcTotals(finances: EventFinanceData[]) {
  const totalRevenue   = finances.reduce((s, f) => s + f.expected_revenue, 0)
  const totalReceived  = finances.reduce((s, f) => s + f.received_amount, 0)
  const totalToReceive = totalRevenue - totalReceived
  const totalCosts     = finances.reduce((s, f) => s + f.items.reduce((si, i) => si + i.amount, 0), 0)
  const totalProfit    = totalRevenue - totalCosts
  const margin         = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  return { totalRevenue, totalReceived, totalToReceive, totalCosts, totalProfit, margin }
}
