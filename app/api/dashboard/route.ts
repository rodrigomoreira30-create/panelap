// app/api/dashboard/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { EventStatus } from '@/lib/generated/prisma/enums'
import { computeReceivedAmount, serializeFinance } from '@/lib/financas'
import { reconcileTeamCosts } from '@/lib/finance-service'
import {
  buildBuckets,
  buildFinanceEvolution,
  countByBucket,
  parsePeriodRange,
  pickGranularity,
  summarizeEventFinances,
  summarizePayments,
  toISODate,
  type AnalysisCriterion,
} from '@/lib/dashboard-period'

// 'closed'/'lost' — default pipeline terminal stages
// 'closed_won'/'closed_lost' — common custom pipeline terminal stage names
const CLOSED_STATUSES = ['closed', 'lost', 'closed_won', 'closed_lost']

const DEFAULT_STAGES = [
  { key: 'new_lead',      label: 'Novo Lead' },
  { key: 'attending',     label: 'Em Atendimento' },
  { key: 'proposal_sent', label: 'Proposta Enviada' },
  { key: 'negotiation',   label: 'Negociação' },
  { key: 'closed',        label: 'Fechado' },
  { key: 'lost',          label: 'Perdido' },
]

/** Período pedido: `from`/`to` (AAAA-MM-DD) ou, por compatibilidade, `days` (últimos N dias). */
function resolveRequestedPeriod(searchParams: URLSearchParams): { from: string; to: string } {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (from && to) return { from, to }
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 1), 365)
  const today = new Date()
  return {
    from: toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))),
    to: toISODate(today),
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const bandSlug = searchParams.get('bandSlug')
  if (!bandSlug) return NextResponse.json({ error: 'bandSlug is required' }, { status: 400 })

  const { from, to } = resolveRequestedPeriod(searchParams)
  const range = parsePeriodRange(from, to)
  if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 })
  const { start, end } = range
  const criterion: AnalysisCriterion =
    searchParams.get('criterio') === 'recebimento' ? 'recebimento' : 'evento'
  const granularity = pickGranularity(start, end)
  const buckets = buildBuckets(start, end, granularity)

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: user.id },
    include: { band: true },
  })
  if (!dbUser || !dbUser.band || dbUser.band.slug !== bandSlug) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bandId = dbUser.band.id
  const raw = dbUser.band.pipeline_stages
  const pipelineStages: { key: string; label: string }[] =
    Array.isArray(raw) && raw.length > 0
      ? (raw as { key: string; label: string }[])
      : DEFAULT_STAGES

  // KPI atual (não depende do período): leads abertos (fora dos status de fechamento)
  const leadsAbertos = await prisma.lead.count({
    where: { band_id: bandId, status: { notIn: CLOSED_STATUSES } },
  })

  // Leads criados no período — base de "leads novos", "leads por período" e "leads por etapa"
  const leadsInPeriod = await prisma.lead.findMany({
    where: { band_id: bandId, created_at: { gte: start, lte: end } },
    select: { created_at: true, status: true },
  })
  const leadsNovos = leadsInPeriod.length
  const leadsByPeriod = countByBucket(leadsInPeriod.map(l => l.created_at), buckets, granularity)
  const countByStage = new Map<string, number>()
  for (const lead of leadsInPeriod) {
    countByStage.set(lead.status, (countByStage.get(lead.status) ?? 0) + 1)
  }
  const leadsByStage = pipelineStages.map(s => ({
    stage: s.label,
    count: countByStage.get(s.key) ?? 0,
  }))

  // KPI atual (não depende do período): carteira — soma do total das atrações dos
  // eventos contratados/em andamento
  const activeEvents = await prisma.event.findMany({
    where: { band_id: bandId, status: { in: [EventStatus.contracted, EventStatus.active] } },
    include: {
      lead: {
        select: {
          proposal_discount: true,
          lead_attractions: { select: { custom_value: true } },
        },
      },
    },
  })
  const faturamentoPrevisto = activeEvents.reduce((sum, e) => {
    if (!e.lead || e.lead.lead_attractions.length === 0) return sum
    const subtotal = e.lead.lead_attractions.reduce(
      (s, a) => s + parseFloat(a.custom_value.toString()),
      0
    )
    const discount = parseFloat((e.lead.proposal_discount ?? 0).toString())
    return sum + Math.max(0, subtotal - discount)
  }, 0)

  // KPI atual (não depende do período): a receber nos próximos 30 dias
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const em30dias = new Date(hoje); em30dias.setDate(hoje.getDate() + 30); em30dias.setHours(23, 59, 59)
  const financesNext30 = await prisma.eventFinance.findMany({
    where: { band_id: bandId, event_date: { gte: hoje, lte: em30dias } },
    select: { expected_revenue: true, received_amount: true, payments: { select: { amount: true } } },
  })
  const aReceber30dias = financesNext30.reduce((s, f) => {
    const saldo = parseFloat(f.expected_revenue.toString()) - computeReceivedAmount(f)
    return s + Math.max(0, saldo)
  }, 0)

  // Indicadores financeiros do período — um critério por vez, nunca misturados.
  let finance
  let financeEvolution
  if (criterion === 'evento') {
    // Mesma consulta do Financeiro Geral (GET /api/financas), só que com intervalo livre:
    // custos de equipe da Formação curados antes, itens e pagamentos completos, e a soma
    // feita por calcTotals/computeEventFinance. Cancelados entram, como lá.
    await reconcileTeamCosts({ bandId })
    const rows = await prisma.eventFinance.findMany({
      where: { band_id: bandId, event_date: { gte: start, lte: end } },
      include: {
        items: { orderBy: { created_at: 'asc' } },
        payments: { orderBy: { payment_date: 'asc' } },
        event: { select: { cancelled_at: true } },
      },
      orderBy: { event_date: 'asc' },
    })
    const finances = rows.map(r => ({ ...serializeFinance(r), cancelled: r.event?.cancelled_at != null }))
    finance = { criterion, ...summarizeEventFinances(finances) }
    financeEvolution = buildFinanceEvolution(finances, buckets, granularity)
  } else {
    // Somente recebimentos registrados (EventPayment), pela data real de cada um.
    const payments = await prisma.eventPayment.findMany({
      where: { payment_date: { gte: start, lte: end }, finance: { band_id: bandId } },
      select: { finance_id: true, payment_date: true, amount: true },
    })
    const summary = summarizePayments(
      payments.map(p => ({ finance_id: p.finance_id, payment_date: p.payment_date, amount: Number(p.amount) })),
      buckets,
      granularity,
    )
    // Valores legados (received_amount sem nenhum EventPayment) não têm data — ficam
    // fora deste critério e são apenas informados, sem estimar uma data.
    const legacy = await prisma.eventFinance.aggregate({
      where: { band_id: bandId, payments: { none: {} }, received_amount: { gt: 0 } },
      _count: { _all: true },
      _sum: { received_amount: true },
    })
    finance = {
      criterion,
      recebido: summary.recebido,
      pagamentos: summary.pagamentos,
      eventos: summary.eventos,
      semData: {
        count: legacy._count._all,
        valor: Number(legacy._sum.received_amount ?? 0),
      },
    }
    financeEvolution = summary.evolution
  }

  // Próximos eventos (não depende do período)
  const upcoming = await prisma.event.findMany({
    where: { band_id: bandId, event_date: { gte: new Date() } },
    select: { id: true, client_name: true, event_date: true, event_type: true },
    orderBy: { event_date: 'asc' },
    take: 5,
  })
  const upcomingEvents = upcoming.map(e => ({
    id: e.id,
    clientName: e.client_name,
    eventDate: e.event_date.toISOString(),
    eventType: e.event_type,
  }))

  return NextResponse.json({
    data: {
      period: { from, to, granularity, criterion },
      kpi: { leadsAbertos, faturamentoPrevisto, leadsNovos, aReceber30dias },
      finance,
      financeEvolution,
      leadsByPeriod,
      leadsByStage,
      upcomingEvents,
    },
  })
}
