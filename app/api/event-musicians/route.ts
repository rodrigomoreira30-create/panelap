import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendEventInviteEmail } from '@/lib/email'

const addMusicianSchema = z.object({
  event_id:   z.string().cuid(),
  user_id:    z.string().cuid(),
  instrument: z.string().optional(),
})

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fullUser = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } })
  if (!fullUser || !['admin', 'producer'].includes(fullUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = addMusicianSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Verify event belongs to band
  const event = await prisma.event.findFirst({
    where: { id: parsed.data.event_id, band_id: sessionUser.band_id },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Verify user belongs to band
  const musician = await prisma.user.findFirst({
    where: { id: parsed.data.user_id, band_id: sessionUser.band_id },
    select: { id: true, name: true, email: true, schedule_token: true },
  })
  if (!musician) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const eventMusician = await prisma.eventMusician.upsert({
    where: {
      event_id_user_id: { event_id: parsed.data.event_id, user_id: parsed.data.user_id },
    },
    create: {
      event_id:   parsed.data.event_id,
      user_id:    parsed.data.user_id,
      instrument: parsed.data.instrument,
      status:     'pending',
    },
    update: { instrument: parsed.data.instrument },
    include: { user: { select: { id: true, name: true, avatar_url: true } } },
  })

  // Enviar email de notificação (sem bloquear a resposta em caso de falha)
  sendEventInviteEmail({
    to:             musician.email,
    musicianName:   musician.name,
    eventName:      event.client_name,
    eventDate:      event.event_date,
    scheduleToken:  musician.schedule_token,
  }).catch(err => console.error('[email] Falha ao enviar convite:', err))

  return NextResponse.json({ data: eventMusician }, { status: 201 })
}

export async function DELETE(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fullUser = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } })
  if (!fullUser || !['admin', 'producer'].includes(fullUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
