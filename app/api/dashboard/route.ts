// app/api/dashboard/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { EventStatus } from '@/lib/generated/prisma/enums'

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

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const bandSlug = searchParams.get('bandSlug')
  const daysParam = searchParams.get('days')
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365) : 30

  if (!bandSlug) return NextResponse.json({ error: 'bandSlug is required' }, { status: 400 })

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

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  startDate.setHours(0, 0, 0, 0)

  // KPI: leads abertos (fora dos status de fechamento)
  const leadsAbertos = await prisma.lead.count({
    where: { band_id: bandId, status: { notIn: CLOSED_STATUSES } },
  })

  // KPI: leads novos no período
  const leadsNovos = await prisma.lead.count({
    where: { band_id: bandId, created_at: { gte: startDate } },
  })

  // KPI: faturamento previsto (eventos contratados ou em andamento)
  const activeEvents = await prisma.event.findMany({
    where: { band_id: bandId, status: { in: [EventStatus.contracted, EventStatus.active] } },
    select: { value: true },
  })
  const faturamentoPrevisto = activeEvents.reduce(
    (sum, e) => sum + parseFloat(e.value.toString()),
    0
  )

  // Leads por dia — todos os dias do intervalo, zeros incluídos
  const leadsInPeriod = await prisma.lead.findMany({
    where: { band_id: bandId, created_at: { gte: startDate } },
    select: { created_at: true },
  })
  const countByDate = new Map<string, number>()
  for (const lead of leadsInPeriod) {
    const dateStr = lead.created_at.toISOString().slice(0, 10)
    countByDate.set(dateStr, (countByDate.get(dateStr) ?? 0) + 1)
  }
  const leadsByDay: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    leadsByDay.push({ date: dateStr, count: countByDate.get(dateStr) ?? 0 })
  }

  // Leads por etapa do pipeline
  const allLeads = await prisma.lead.findMany({
    where: { band_id: bandId },
    select: { status: true },
  })
  const countByStage = new Map<string, number>()
  for (const lead of allLeads) {
    countByStage.set(lead.status, (countByStage.get(lead.status) ?? 0) + 1)
  }
  const leadsByStage = pipelineStages.map(s => ({
    stage: s.label,
    count: countByStage.get(s.key) ?? 0,
  }))

  // Próximos eventos
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
      kpi: { leadsAbertos, faturamentoPrevisto, leadsNovos },
      leadsByDay,
      leadsByStage,
      upcomingEvents,
    },
  })
}
