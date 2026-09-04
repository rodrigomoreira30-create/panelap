import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendEventInviteEmail } from '@/lib/email'

const addSchema = z.object({
  event_id:    z.string().cuid(),
  user_id:     z.string().cuid().optional(),
  instrument:  z.string().optional(),
  cache_value: z.number().optional(),
})

const assignSchema = z.object({
  id:          z.string().cuid(),
  user_id:     z.string().cuid().optional(),
  cache_value: z.number().optional().nullable(),
})

async function getAdminOrProducer() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return null
  const fullUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  })
  if (!fullUser || !['admin', 'producer'].includes(fullUser.role)) return null
  return sessionUser
}

export async function POST(request: Request) {
  const sessionUser = await getAdminOrProducer()
  if (!sessionUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.event_id, band_id: sessionUser.band_id },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  let musician: { id: string; name: string; email: string; schedule_token: string } | null = null
  if (parsed.data.user_id) {
    musician = await prisma.user.findFirst({
      where: { id: parsed.data.user_id, band_id: sessionUser.band_id },
      select: { id: true, name: true, email: true, schedule_token: true },
    })
    if (!musician) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const em = await prisma.eventMusician.create({
    data: {
      event_id:    parsed.data.event_id,
      user_id:     parsed.data.user_id ?? null,
      instrument:  parsed.data.instrument,
      cache_value: parsed.data.cache_value ?? null,
      status:      'pending',
    },
    include: { user: { select: { id: true, name: true, avatar_url: true, schedule_token: true } } },
  })

  if (musician) {
    sendEventInviteEmail({
      to:            musician.email,
      musicianName:  musician.name,
      eventName:     event.client_name,
      eventDate:     event.event_date,
      scheduleToken: musician.schedule_token,
    }).catch(err => console.error('[email] Falha ao enviar convite:', err))
  }

  return NextResponse.json({ data: em }, { status: 201 })
}

export async function PATCH(request: Request) {
  const sessionUser = await getAdminOrProducer()
  if (!sessionUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const existing = await prisma.eventMusician.findUnique({
    where: { id: parsed.data.id },
    include: { event: { select: { band_id: true, client_name: true, event_date: true } } },
  })
  if (!existing || existing.event.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let musician: { name: string; email: string; schedule_token: string } | null = null
  if (parsed.data.user_id) {
    musician = await prisma.user.findFirst({
      where: { id: parsed.data.user_id, band_id: sessionUser.band_id },
      select: { name: true, email: true, schedule_token: true },
    })
    if (!musician) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const wasVacant = existing.user_id === null
  const isBeingAssigned = parsed.data.user_id !== undefined && parsed.data.user_id !== existing.user_id

  const updated = await prisma.eventMusician.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.user_id !== undefined && { user_id: parsed.data.user_id }),
      ...('cache_value' in parsed.data && { cache_value: parsed.data.cache_value }),
      ...(isBeingAssigned && { status: 'pending' }),
    },
    include: { user: { select: { id: true, name: true, avatar_url: true, schedule_token: true } } },
  })

  if (wasVacant && isBeingAssigned && musician) {
    sendEventInviteEmail({
      to:            musician.email,
      musicianName:  musician.name,
      eventName:     existing.event.client_name,
      eventDate:     existing.event.event_date,
      scheduleToken: musician.schedule_token,
    }).catch(err => console.error('[email] Falha ao enviar convite:', err))
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(request: Request) {
  const sessionUser = await getAdminOrProducer()
  if (!sessionUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const em = await prisma.eventMusician.findUnique({
    where: { id },
    include: { event: { select: { band_id: true } } },
  })
  if (!em || em.event.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.eventMusician.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
