import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { startOfMonth, endOfMonth } from 'date-fns'
import { CalendarView } from '@/components/agenda/CalendarView'

type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  resource: {
    status: string
    type: string
    musicians: string[]
  }
}

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const band = await prisma.band.findUnique({
    where: { slug: bandSlug },
    select: { id: true },
  })
  if (!band || band.id !== dbUser.band_id) return notFound()

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const events = await prisma.event.findMany({
    where: {
      band_id: dbUser.band_id,
      event_date: { gte: monthStart, lte: monthEnd },
      status: { in: ['contracted', 'active'] as ('contracted' | 'active')[] },
    },
    include: {
      event_musicians: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { event_date: 'asc' },
  })

  const calendarEvents: CalendarEvent[] = events.map(e => ({
    id: e.id,
    title: `${e.client_name} — ${e.venue_name}`,
    start: e.event_date,
    end: e.event_date,
    resource: {
      status: e.status,
      type: e.event_type,
      musicians: e.event_musicians.map(em => em.user.name),
    },
  }))

  const pendingMusicians = await prisma.eventMusician.findMany({
    where: {
      event: {
        band_id: dbUser.band_id,
        status: { in: ['contracted', 'active'] as ('contracted' | 'active')[] },
      },
      status: 'pending',
    },
    include: {
      user: { select: { name: true } },
      event: { select: { client_name: true, event_type: true, event_date: true } },
    },
    orderBy: { event: { event_date: 'asc' } },
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Agenda</h1>
      {pendingMusicians.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-semibold text-yellow-800 mb-2">
            Confirmações Pendentes ({pendingMusicians.length})
          </h2>
          <ul className="space-y-1 text-sm text-yellow-700">
            {pendingMusicians.map(pm => (
              <li key={`${pm.event_id}-${pm.user_id}`}>
                <span className="font-medium">{pm.user.name}</span>
                {' — '}
                {pm.event.client_name} ({pm.event.event_type})
                {' ('}
                {pm.event.event_date
                  ? new Date(pm.event.event_date).toLocaleDateString('pt-BR')
                  : 'data não informada'}
                {')'}
              </li>
            ))}
          </ul>
        </div>
      )}
      <CalendarView initialEvents={calendarEvents} />
    </div>
  )
}
