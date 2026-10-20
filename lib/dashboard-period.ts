// lib/dashboard-period.ts
//
// Filtros de período do Dashboard: resolução de presets, validação de intervalos,
// agrupamento (dia/semana/mês) e agregação financeira.
//
// Os valores financeiros NÃO têm cálculo próprio aqui: tudo passa por
// `calcTotals` / `computeEventFinance` / `computeReceivedAmount` (lib/financas.ts),
// os mesmos usados pelo Financeiro Geral — o Dashboard só agrupa e soma o resultado.
//
// Datas e fuso (mesma convenção do resto do sistema — ver lib/production/musician-schedule.ts):
// - `event_date` e `payment_date` são DATAS CIVIS gravadas à meia-noite UTC do dia escolhido
//   (input "2026-10-01" → 2026-10-01T00:00:00.000Z). O período desses campos é, portanto,
//   [AAAA-MM-DDT00:00:00.000Z, AAAA-MM-DDT23:59:59.999Z], independente do fuso do servidor.
// - `created_at` (leads) é um instante real: o dia civil é o do fuso do sistema (Brasil).
// - "Hoje" (atalhos 7/30/90 dias, Este mês, Este ano) é o dia corrente no fuso do sistema.
//
// Internamente uma "data civil" é um Date à meia-noite UTC, manipulado só com getters UTC.

import { calcTotals, computeEventFinance, round2, type EventFinanceData } from '@/lib/financas'

export type PeriodPreset = '7d' | '30d' | '90d' | 'month' | 'year' | 'custom'
export type AnalysisCriterion = 'evento' | 'recebimento'
export type Granularity = 'day' | 'week' | 'month'
export type Bucket = { key: string; label: string }

export const SYSTEM_TIMEZONE = 'America/Sao_Paulo'
const MAX_RANGE_YEARS = 10
const DAY_MS = 86_400_000
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function civil(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d))
}

/** Data civil → 'YYYY-MM-DD'. */
export function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** 'YYYY-MM-DD' → data civil (meia-noite UTC), ou null se inválida (ex.: 30/02). */
export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = civil(y, mo - 1, d)
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  return date
}

/** Dia civil, no fuso do sistema, de um instante real (ex.: `created_at`). */
export function civilDayInTimezone(instant: Date, timeZone = SYSTEM_TIMEZONE): Date {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant)
  return parseISODate(key)!
}

/** Instante em que o dia civil `iso` começa no fuso do sistema (ex.: 00:00 de Brasília). */
export function zonedStartOfDay(iso: string, timeZone = SYSTEM_TIMEZONE): Date {
  const guess = parseISODate(iso)!.getTime()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess))
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  const asSeenInZone = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return new Date(guess - (asSeenInZone - guess))
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA'. */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatPeriodLabel(from: string, to: string): string {
  return `${formatDateBR(from)} a ${formatDateBR(to)}`
}

/** Intervalo de um preset, a partir de "hoje" no fuso do sistema.
 *  7/30/90 dias = os últimos N dias, terminando hoje (dias anteriores, hoje incluído);
 *  "Este mês" e "Este ano" cobrem o período civil inteiro, incluindo dias futuros. */
export function resolvePresetRange(
  preset: Exclude<PeriodPreset, 'custom'>,
  now: Date,
): { from: string; to: string } {
  const today = civilDayInTimezone(now)
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const d = today.getUTCDate()
  switch (preset) {
    case 'month':
      return { from: toISODate(civil(y, m, 1)), to: toISODate(civil(y, m + 1, 0)) }
    case 'year':
      return { from: toISODate(civil(y, 0, 1)), to: toISODate(civil(y, 11, 31)) }
    default: {
      const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
      return { from: toISODate(civil(y, m, d - (days - 1))), to: toISODate(today) }
    }
  }
}

export type PeriodRange = {
  /** Primeiro dia (data civil, 00:00:00.000Z) — para `event_date` / `payment_date`. */
  start: Date
  /** Último dia inteiro (23:59:59.999Z) — para `event_date` / `payment_date`. */
  end: Date
  /** 00:00 do primeiro dia no fuso do sistema — para instantes reais (`created_at`). */
  instantStart: Date
  /** 23:59:59.999 do último dia no fuso do sistema — para instantes reais (`created_at`). */
  instantEnd: Date
}

/** Valida from/to (AAAA-MM-DD) e devolve o intervalo fechado, primeiro e último dia inteiros. */
export function parsePeriodRange(from: string, to: string): PeriodRange | { error: string } {
  const start = parseISODate(from)
  const endDay = parseISODate(to)
  if (!start || !endDay) return { error: 'Datas inválidas — use o formato AAAA-MM-DD' }
  if (start > endDay) return { error: 'A data inicial deve ser anterior ou igual à data final' }
  const limit = civil(start.getUTCFullYear() + MAX_RANGE_YEARS, start.getUTCMonth(), start.getUTCDate())
  if (endDay > limit) return { error: `O período máximo é de ${MAX_RANGE_YEARS} anos` }
  const nextDay = toISODate(new Date(endDay.getTime() + DAY_MS))
  return {
    start,
    end: new Date(endDay.getTime() + DAY_MS - 1),
    instantStart: zonedStartOfDay(from),
    instantEnd: new Date(zonedStartOfDay(nextDay).getTime() - 1),
  }
}

/** Até 31 dias → dia; até ~4 meses → semana; acima disso → mês. */
export function pickGranularity(start: Date, end: Date): Granularity {
  const days = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

function weekStart(d: Date): Date {
  const offset = (d.getUTCDay() + 6) % 7 // segunda-feira = 0
  return civil(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset)
}

/** Chave do intervalo de uma data civil (`event_date`, `payment_date`). */
export function bucketKeyFor(date: Date, g: Granularity): string {
  if (g === 'day') return toISODate(date)
  if (g === 'week') return toISODate(weekStart(date))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`
}

/** Todos os intervalos do período, na ordem, incluindo os vazios. */
export function buildBuckets(start: Date, end: Date, g: Granularity): Bucket[] {
  const buckets: Bucket[] = []
  const label = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`
  if (g === 'day') {
    for (let d = start; d <= end; d = new Date(d.getTime() + DAY_MS)) {
      buckets.push({ key: toISODate(d), label: label(d) })
    }
  } else if (g === 'week') {
    for (let w = weekStart(start); w <= end; w = new Date(w.getTime() + 7 * DAY_MS)) {
      buckets.push({ key: toISODate(w), label: label(w < start ? start : w) })
    }
  } else {
    for (let m = civil(start.getUTCFullYear(), start.getUTCMonth(), 1); m <= end; m = civil(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)) {
      buckets.push({
        key: bucketKeyFor(m, 'month'),
        label: `${MONTHS_SHORT[m.getUTCMonth()]}/${String(m.getUTCFullYear()).slice(2)}`,
      })
    }
  }
  return buckets
}

/** Conta instantes reais (ex.: criação de leads) por intervalo, pelo dia civil no fuso do sistema. */
export function countByBucket(instants: Date[], buckets: Bucket[], g: Granularity) {
  const counts = new Map<string, number>()
  for (const i of instants) {
    const k = bucketKeyFor(civilDayInTimezone(i), g)
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
  /** Recebido ÷ receita prevista × 100; null quando não há receita prevista. */
  percentualRecebido: number | null
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
  const recebido = round2(t.totalReceived)
  return {
    faturamentoPrevisto,
    recebido,
    aReceber: round2(t.totalToReceive),
    custos: round2(t.totalCosts),
    lucroPrevisto,
    margemPrevista: faturamentoPrevisto > 0 ? round2((lucroPrevisto / faturamentoPrevisto) * 100) : null,
    percentualRecebido: faturamentoPrevisto > 0 ? round2((recebido / faturamentoPrevisto) * 100) : null,
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
