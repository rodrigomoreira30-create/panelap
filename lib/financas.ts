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
  // Identidade estável (User.id) + função do músico na atribuição que gerou este custo —
  // presente só quando a consulta inclui a relação `event_musician` (hoje, a listagem do
  // Financeiro Geral). Usado para agrupar a matriz "Equipe / Cachês" por membro+função em
  // vez de nome/instrumento soltos — ver lib/financas-team-matrix.ts.
  event_musician?: { user_id: string; instrument: string | null } | null
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
      // Sem user_id (vaga aberta) não há identidade estável para agrupar — tratado como
      // órfão pela matriz, igual a um item sem event_musician nenhum.
      event_musician:     i.event_musician?.user_id
        ? { user_id: i.event_musician.user_id, instrument: i.event_musician.instrument ?? null }
        : null,
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

/** Um valor monetário como ele chega cru do Prisma (Decimal, com `toString()`)
 * ou já convertido para `number` (ex.: depois de `serializeFinance`). Usar `Number(x)`
 * funciona igual para os dois casos, permitindo que a mesma função sirva tanto
 * dados já serializados (EventFinanceData) quanto resultados de `select` parciais. */
type DecimalLike = number | { toString(): string }

/** Valor recebido "vivo" de um evento: se já existe pelo menos um recebimento
 * registrado no histórico (EventPayment), a soma deles é a fonte da verdade.
 * Caso contrário, preserva o valor legado gravado manualmente em `received_amount`
 * (compatibilidade com eventos antigos, sem risco de duplicar receita).
 *
 * Única fonte de verdade para "valor recebido" no sistema — reutilizada pelo
 * Financeiro do evento, pelo Financeiro Geral e pelo Dashboard. */
export function computeReceivedAmount(finance: {
  received_amount: DecimalLike
  payments: { amount: DecimalLike }[]
}): number {
  if (finance.payments.length === 0) return Number(finance.received_amount)
  return round2(finance.payments.reduce((s, p) => s + Number(p.amount), 0))
}

/** Totais agregados de uma lista de eventos (Financeiro Geral, Dashboard), somando
 * diretamente os valores já computados por `computeEventFinance()` de cada evento —
 * garante que o consolidado seja sempre igual à soma exata do que aparece na aba
 * Financeiro de cada evento individualmente, sem recalcular por outra via. */
export function calcTotals(finances: EventFinanceData[]) {
  let totalRevenue = 0
  let totalReceived = 0
  let totalToReceive = 0
  let totalCosts = 0
  let totalProfit = 0

  for (const f of finances) {
    const t = computeEventFinance(f)
    totalRevenue   += t.revenueForecast
    totalReceived  += t.received
    totalToReceive += t.receivable
    totalCosts     += t.costTotal
    totalProfit    += t.profit
  }

  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  return { totalRevenue, totalReceived, totalToReceive, totalCosts, totalProfit, margin }
}

/** Valor "vivo" de um item: se tem percentual e não foi sobrescrito manualmente, é
 * sempre recalculado a partir da receita prevista; senão, usa o valor gravado. */
/** Total da equipe: soma dos cachês de músicos/equipe (categoria cache_musico). */
export function computeTeamTotal(items: { category: string; amount: number }[]): number {
  return round2(
    items
      .filter(i => i.category === CACHE_MUSICO_CATEGORY)
      .reduce((s, i) => s + i.amount, 0)
  )
}

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
