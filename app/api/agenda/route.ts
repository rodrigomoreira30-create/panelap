import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { buildCalendarItems } from '@/lib/agenda/calendar-items'

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
        // Etapa do lead no pipeline: é ela que diz se o evento está "fechado" (cor azul)
        lead: { select: { status: true } },
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

  const calendarEvents = buildCalendarItems(events, leads)

  return NextResponse.json({ data: calendarEvents })
}
