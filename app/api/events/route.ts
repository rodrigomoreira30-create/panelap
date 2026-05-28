import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  // Valid statuses
  const VALID_STATUSES = ['contracted', 'active', 'done']
  const statusFilter = status && VALID_STATUSES.includes(status)
    ? { status: status as 'contracted' | 'active' | 'done' }
    : { status: { in: ['contracted', 'active'] as ('contracted' | 'active')[] } }

  const events = await prisma.event.findMany({
    where: { band_id: sessionUser.band_id, ...statusFilter },
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
