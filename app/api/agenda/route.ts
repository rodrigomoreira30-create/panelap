import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const events = await prisma.event.findMany({
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
  })

  const calendarEvents = events.map(e => ({
    id:    e.id,
    title: `${e.client_name} — ${e.venue_name}`,
    start: new Date(e.event_date),
    end:   new Date(e.event_date),
    resource: {
      status:    e.status,
      type:      e.event_type,
      musicians: e.event_musicians.map(em => em.user.name),
    },
  }))

  return NextResponse.json({ data: calendarEvents })
}
