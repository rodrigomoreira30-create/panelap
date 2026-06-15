import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  const [events, leads] = await Promise.all([
    prisma.event.findMany({
      where: {
        band_id: sessionUser.band_id,
        event_date: { gte: start, lte: end },
      },
      include: {
        event_musicians: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { event_date: 'asc' },
    }),
    prisma.lead.findMany({
      where: {
        band_id: sessionUser.band_id,
        event_date: { gte: start, lte: end },
        status: { notIn: ['closed', 'lost'] },
      },
      orderBy: { event_date: 'asc' },
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

  return NextResponse.json({ data: calendarEvents })
}
