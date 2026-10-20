// lib/dashboard-period.ts
//
// Filtros de período do Dashboard: resolução de presets, validação de intervalos,
// agrupamento (dia/semana/mês) e agregação financeira.
//
// Os valores financeiros NÃO têm cálculo próprio aqui: tudo passa por
// `calcTotals` / `computeEventFinance` / `computeReceivedAmount` (lib/financas.ts),
// os mesmos usados pelo Financeiro Geral — o Dashboard só agrupa e soma o resultado.
//
// Todas as datas são tratadas no horário local do servidor, igual ao Financeiro Geral
// (`new Date(year, month - 1, 1)`), para que "Este mês" no Dashboard e o mês no
// Financeiro Geral selecionem exatamente os mesmos eventos.

import { calcTotals, computeEventFinance, round2, type EventFinanceData } from '@/lib/financas'

export type PeriodPreset = '7d' | '30d' | '90d' | 'month' | 'year' | 'custom'
export type AnalysisCriterion = 'evento' | 'recebimento'
export type Granularity = 'day' | 'week' | 'month'
export type Bucket = { key: string; label: string }

const MAX_RANGE_YEARS = 10
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Data local → 'YYYY-MM-DD'. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' → meia-noite local, ou null se inválida (ex.: 30/02). */
export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA'. */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatPeriodLabel(from: string, to: string): string {
  return `${formatDateBR(from)} a ${formatDateBR(to)}`
}

/** Intervalo de um preset. 7/30/90 dias terminam hoje (comportamento original);
 *  "Este mês" e "Este ano" cobrem o período inteiro, incluindo eventos futuros. */
export function resolvePresetRange(
  preset: Exclude<PeriodPreset, 'custom'>,
  today: Date,
): { from: string; to: string } {
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()
  switch (preset) {
    case 'month':
      return { from: toISODate(new Date(y, m, 1)), to: toISODate(new Date(y, m + 1, 0)) }
    case 'year':
      return { from: toISODate(new Date(y, 0, 1)), to: toISODate(new Date(y, 11, 31)) }
    default: {
      const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
      return { from: toISODate(new Date(y, m, d - (days - 1))), to: toISODate(new Date(y, m, d)) }
    }
  }
}

/** Valida from/to e devolve o intervalo fechado [início do dia, fim do dia]. */
export function parsePeriodRange(
  from: string,
  to: string,
): { start: Date; end: Date } | { error: string } {
  const start = parseISODate(from)
  const endDay = parseISODate(to)
  if (!start || !endDay) return { error: 'Datas inválidas — use o formato AAAA-MM-DD' }
  if (start > endDay) return { error: 'A data inicial deve ser anterior ou igual à data final' }
  const limit = new Date(start.getFullYear() + MAX_RANGE_YEARS, start.getMonth(), start.getDate())
  if (endDay > limit) return { error: `O período máximo é de ${MAX_RANGE_YEARS} anos` }
  const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59, 999)
  return { start, end }
}

function daysBetween(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((b - a) / 86_400_000) + 1
}

/** Até 31 dias → dia; até ~4 meses → semana; acima disso → mês. */
export function pickGranularity(start: Date, end: Date): Granularity {
  const days = daysBetween(start, end)
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

function weekStart(d: Date): Date {
  const offset = (d.getDay() + 6) % 7 // segunda-feira = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset)
}

export function bucketKeyFor(date: Date, g: Granularity): string {
  if (g === 'day') return toISODate(date)
  if (g === 'week') return toISODate(weekStart(date))
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** Todos os intervalos do período, na ordem, incluindo os vazios. */
export function buildBuckets(start: Date, end: Date, g: Granularity): Bucket[] {
  const buckets: Bucket[] = []
  if (g === 'day') {
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      buckets.push({ key: toISODate(d), label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` })
    }
  } else if (g === 'week') {
    for (let w = weekStart(start); w <= end; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
      const shown = w < start ? start : w
      buckets.push({ key: toISODate(w), label: `${pad(shown.getDate())}/${pad(shown.getMonth() + 1)}` })
    }
  } else {
    for (let m = new Date(start.getFullYear(), start.getMonth(), 1); m <= end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      buckets.push({
        key: bucketKeyFor(m, 'month'),
        label: `${MONTHS_SHORT[m.getMonth()]}/${String(m.getFullYear()).slice(2)}`,
      })
    }
  }
  return buckets
}

/** Conta ocorrências (ex.: criação de leads) por intervalo. */
export function countByBucket(dates: Date[], buckets: Bucket[], g: Granularity) {
  const counts = new Map<string, number>()
  for (const d of dates) {
    const k = bucketKeyFor(d, g)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return buckets.map(b => ({ ...b, count: counts.get(b.key) ?? 0 }))
}

export type DashboardFinanceSummary = {
  faturamentoPrevisto: number
  recebido: number
  aReceber: number
  custos: number
  lucroPrevisto: number
  /** null quando não há faturamento previsto (evita divisão por zero). */
  margemPrevista: number | null
  eventos: number
  cancelados: { count: number; faturamentoPrevisto: number }
}

/** Indicadores por data do evento. Soma via `calcTotals` (Financeiro Geral).
 *  Eventos cancelados entram nos totais — mesma regra do Financeiro Geral — e são
 *  contados à parte apenas para exibição. */
export function summarizeEventFinances(
  finances: (EventFinanceData & { cancelled?: boolean })[],
): DashboardFinanceSummary {
  const t = calcTotals(finances)
  const cancelled = finances.filter(f => f.cancelled)
  const faturamentoPrevisto = round2(t.totalRevenue)
  const lucroPrevisto = round2(t.totalProfit)
  return {
    faturamentoPrevisto,
    recebido: round2(t.totalReceived),
    aReceber: round2(t.totalToReceive),
    custos: round2(t.totalCosts),
    lucroPrevisto,
    margemPrevista: faturamentoPrevisto > 0 ? round2((lucroPrevisto / faturamentoPrevisto) * 100) : null,
    eventos: finances.length,
    cancelados: {
      count: cancelled.length,
      faturamentoPrevisto: round2(cancelled.reduce((s, f) => s + f.expected_revenue, 0)),
    },
  }
}

export type FinanceEvolutionPoint = Bucket & { faturamento: number; custos: number; lucro: number }

/** Evolução financeira por data do evento, usando `computeEventFinance` de cada evento. */
export function buildFinanceEvolution(
  finances: EventFinanceData[],
  buckets: Bucket[],
  g: Granularity,
): FinanceEvolutionPoint[] {
  const acc = new Map<string, { faturamento: number; custos: number; lucro: number }>()
  for (const f of finances) {
    const k = bucketKeyFor(new Date(f.event_date), g)
    const t = computeEventFinance(f)
    const cur = acc.get(k) ?? { faturamento: 0, custos: 0, lucro: 0 }
    cur.faturamento += t.revenueForecast
    cur.custos += t.costTotal
    cur.lucro += t.profit
    acc.set(k, cur)
  }
  return buckets.map(b => {
    const v = acc.get(b.key)
    return {
      ...b,
      faturamento: round2(v?.faturamento ?? 0),
      custos: round2(v?.custos ?? 0),
      lucro: round2(v?.lucro ?? 0),
    }
  })
}

export type PaymentRow = { finance_id: string; payment_date: Date; amount: number }
export type PaymentEvolutionPoint = Bucket & { recebido: number }

/** Indicadores por data do recebimento: somente pagamentos registrados (EventPayment),
 *  cada um na sua data real. Nenhuma data é estimada. */
export function summarizePayments(payments: PaymentRow[], buckets: Bucket[], g: Granularity) {
  const acc = new Map<string, number>()
  let total = 0
  for (const p of payments) {
    const k = bucketKeyFor(p.payment_date, g)
    acc.set(k, (acc.get(k) ?? 0) + p.amount)
    total += p.amount
  }
  return {
    recebido: round2(total),
    pagamentos: payments.length,
    eventos: new Set(payments.map(p => p.finance_id)).size,
    evolution: buckets.map(b => ({ ...b, recebido: round2(acc.get(b.key) ?? 0) })) as PaymentEvolutionPoint[],
  }
}
