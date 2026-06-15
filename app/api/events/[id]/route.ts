import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { eventUpdateSchema } from '@/lib/validations/event'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findFirst({
    where: { id, band_id: sessionUser.band_id },
    include: {
      lead: { select: { id: true, phone: true } },
      checklists: { include: { items: { orderBy: { id: 'asc' } } } },
      event_musicians: {
        include: { user: { select: { id: true, name: true, avatar_url: true, schedule_token: true } } },
        orderBy: { id: 'asc' },
      },
      documents: { orderBy: { created_at: 'desc' } },
    },
  })

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: event })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check — get full user to check role
  const fullUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  })
  if (!fullUser || !['admin', 'producer'].includes(fullUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = eventUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Verify event belongs to band
  const existing = await prisma.event.findFirst({
    where: { id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { event_date, technical_visit_date, ...rest } = parsed.data
  const updated = await prisma.event.update({
    where: { id },
    data: {
      ...rest,
      ...(event_date !== undefined && {
        event_date: new Date(event_date),
      }),
      ...(technical_visit_date !== undefined && {
        technical_visit_date: technical_visit_date ? new Date(technical_visit_date) : null,
      }),
    },
  })

  return NextResponse.json({ data: updated })
}
