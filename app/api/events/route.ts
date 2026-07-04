import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status     = searchParams.get('status')
  const noFinance  = searchParams.get('noFinance') === 'true'
  const monthParam = searchParams.get('month')
  const yearParam  = searchParams.get('year')

  const VALID_STATUSES = ['contracted', 'active', 'done']
  const statusFilter = status && VALID_STATUSES.includes(status)
    ? { status: status as 'contracted' | 'active' | 'done' }
    : { status: { in: ['contracted', 'active'] as ('contracted' | 'active')[] } }

  const dateFilter =
    monthParam && yearParam
      ? {
          event_date: {
            gte: new Date(parseInt(yearParam), parseInt(monthParam) - 1, 1),
            lte: new Date(parseInt(yearParam), parseInt(monthParam), 0, 23, 59, 59),
          },
        }
      : {}

  if (noFinance) {
    const events = await prisma.event.findMany({
      where: {
        band_id: sessionUser.band_id,
        ...statusFilter,
        ...dateFilter,
        finance: null,
      },
      select: { id: true, client_name: true, event_date: true },
      orderBy: { event_date: 'asc' },
    })
    return NextResponse.json({ data: events.map(e => ({
      id: e.id,
      client_name: e.client_name,
      event_date: e.event_date.toISOString(),
    })) })
  }

  const events = await prisma.event.findMany({
    where: { band_id: sessionUser.band_id, ...statusFilter, ...dateFilter },
    include: {
      checklists: {
        include: { items: { select: { id: true, done: true } } },
      },
      event_musicians: { select: { id: true, status: true } },
    },
    orderBy: { event_date: 'asc' },
  })

  return NextResponse.json({ data: events })
}
