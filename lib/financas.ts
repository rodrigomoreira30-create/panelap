// lib/financas.ts

export type FinanceItemData = {
  id: string
  finance_id: string
  category: string
  label: string
  amount: number
  paid: boolean
  notes: string | null
  percent_of_revenue: number | null
  is_overridden: boolean
  event_musician_id: string | null
}

export type EventPaymentData = {
  id: string
  finance_id: string
  payment_date: string
  amount: number
  payment_method: string
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
  payments: EventPaymentData[]
}

export const CACHE_MUSICO_CATEGORY = 'cache_musico'

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
  { category: 'outros',            label: 'Outros custos' },
]

export const PERCENT_ELIGIBLE_CATEGORIES = new Set([
  'comissao_panel',
  'comissao_vendedor',
  'nota_fiscal',
])

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

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
      id:                 i.id,
      finance_id:         i.finance_id,
      category:           i.category,
      label:              i.label,
      amount:             parseFloat(i.amount.toString()),
      paid:               i.paid,
      notes:              i.notes ?? null,
      percent_of_revenue: i.percent_of_revenue !== null && i.percent_of_revenue !== undefined
        ? parseFloat(i.percent_of_revenue.toString())
        : null,
      is_overridden:      i.is_overridden ?? false,
      event_musician_id:  i.event_musician_id ?? null,
    })),
    payments: (f.payments ?? []).map((p: any) => ({
      id:             p.id,
      finance_id:     p.finance_id,
      payment_date:   p.payment_date instanceof Date ? p.payment_date.toISOString() : p.payment_date,
      amount:         parseFloat(p.amount.toString()),
      payment_method: p.payment_method,
      notes:          p.notes ?? null,
    })),
  }
}

export function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function parseBR(raw: string): number {
  return parseFloat(raw.trim().replace(/\./g, '').replace(',', '.'))
}

/** Valor recebido "vivo" de um evento: se já existe pelo menos um recebimento
 * registrado no histórico (EventPayment), a soma deles é a fonte da verdade.
 * Caso contrário, preserva o valor legado gravado manualmente em `received_amount`
 * (compatibilidade com eventos antigos, sem risco de duplicar receita). */
export function computeReceivedAmount(finance: Pick<EventFinanceData, 'received_amount' | 'payments'>): number {
  if (finance.payments.length === 0) return finance.received_amount
  return round2(finance.payments.reduce((s, p) => s + p.amount, 0))
}

export function calcTotals(finances: EventFinanceData[]) {
  const totalRevenue   = finances.reduce((s, f) => s + f.expected_revenue, 0)
  const totalReceived  = finances.reduce((s, f) => s + computeReceivedAmount(f), 0)
  const totalToReceive = totalRevenue - totalReceived
  const totalCosts     = finances.reduce(
    (s, f) => s + computeEventFinance(f).costTotal, 0
  )
  const totalProfit    = totalRevenue - totalCosts
  const margin         = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  return { totalRevenue, totalReceived, totalToReceive, totalCosts, totalProfit, margin }
}

/** Valor "vivo" de um item: se tem percentual e não foi sobrescrito manualmente, é
 * sempre recalculado a partir da receita prevista; senão, usa o valor gravado. */
export function resolveItemAmount(item: FinanceItemData, revenueForecast: number): number {
  if (item.percent_of_revenue !== null && !item.is_overridden) {
    return round2((revenueForecast * item.percent_of_revenue) / 100)
  }
  return item.amount
}

export type EventFinanceTotals = {
  revenueForecast: number
  received: number
  receivable: number
  costTotal: number
  costByCategory: Record<string, number>
  profit: number
  marginPercent: number | null
  cashProfit: number
}

export function computeEventFinance(finance: EventFinanceData): EventFinanceTotals {
  const revenueForecast = finance.expected_revenue
  const received        = computeReceivedAmount(finance)
  const receivable       = round2(revenueForecast - received)

  const costByCategory: Record<string, number> = {}
  let costTotal = 0
  let paidCostTotal = 0

  for (const item of finance.items) {
    const amount = resolveItemAmount(item, revenueForecast)
    costByCategory[item.category] = round2((costByCategory[item.category] ?? 0) + amount)
    costTotal += amount
    if (item.paid) paidCostTotal += amount
  }
  costTotal = round2(costTotal)
  paidCostTotal = round2(paidCostTotal)

  const profit = round2(revenueForecast - costTotal)
  const marginPercent = revenueForecast === 0 ? null : round2((profit / revenueForecast) * 100)
  const cashProfit = round2(received - paidCostTotal)

  return { revenueForecast, received, receivable, costTotal, costByCategory, profit, marginPercent, cashProfit }
}
