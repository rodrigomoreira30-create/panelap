export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CalendarView } from '@/components/agenda/CalendarView'
import { PendingConfirmations } from '@/components/agenda/PendingConfirmations'

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const band = await prisma.band.findUnique({ where: { slug: bandSlug }, select: { id: true } })
  if (!band || band.id !== dbUser.band_id) return notFound()

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  const [events, leads, pendingMusicians] = await Promise.all([
    prisma.event.findMany({
      where: {
        band_id: dbUser.band_id,
        event_date: { gte: monthStart, lte: monthEnd },
      },
      include: {
        event_musicians: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { event_date: 'asc' },
    }),
    prisma.lead.findMany({
      where: {
        band_id: dbUser.band_id,
        event_date: { gte: monthStart, lte: monthEnd },
        status: { notIn: ['closed', 'lost'] },
      },
      orderBy: { event_date: 'asc' },
    }),
    prisma.eventMusician.findMany({
      where: {
        event: {
          band_id: dbUser.band_id,
          status: { in: ['contracted', 'active'] },
        },
        status: 'pending',
      },
      include: {
        user: { select: { name: true } },
        event: { select: { client_name: true, event_type: true, event_date: true } },
      },
      orderBy: { event: { event_date: 'asc' } },
    }),
  ])

  const calendarEvents = [
    ...events.map(e => ({
      id:    e.id,
      title: e.client_name,
      start: e.event_date,
      end:   e.event_date,
      resource: {
        kind:      'event' as const,
        status:    e.status,
        eventType: e.event_type,
        venue:     e.venue_name,
        musicians: e.event_musicians.map(em => em.user.name),
      },
    })),
    ...leads.map(l => ({
      id:    l.id,
      title: l.client_name,
      start: l.event_date!,
      end:   l.event_date!,
      resource: {
        kind:      'lead' as const,
        status:    l.status,
        eventType: l.event_type,
        venue:     l.venue_name ?? null,
        musicians: [] as string[],
      },
    })),
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
            Evento contratado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            Orçamento em aberto
          </span>
        </div>
      </div>

      <PendingConfirmations items={pendingMusicians.map(pm => ({
        event_id: pm.event_id,
        user_id:  pm.user_id,
        user:     { name: pm.user.name },
        event:    { client_name: pm.event.client_name, event_type: pm.event.event_type, event_date: pm.event.event_date },
      }))} />

      <CalendarView initialEvents={calendarEvents} bandSlug={bandSlug} />
    </div>
  )
}
