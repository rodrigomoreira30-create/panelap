import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadUpdateSchema } from '@/lib/validations/lead'
import { eventBus } from '@/lib/events/internal-bus'
import { getDefaultChecklist } from '@/lib/production/default-checklists'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = await prisma.lead.findUnique({
    where: { id, band_id: sessionUser.band_id },
    include: {
      messages: { orderBy: { sent_at: 'asc' } },
      assignee: { select: { id: true, name: true, avatar_url: true } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: lead })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = leadUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const existing = await prisma.lead.findUnique({
    where: { id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { tags, event_date, ...rest } = parsed.data
    const updated = await prisma.lead.update({
      where: { id, band_id: sessionUser.band_id },
      data: {
        ...rest,
        ...(tags !== undefined && { tags: tags as unknown as object }),
        event_date: event_date === undefined
          ? undefined
          : event_date
            ? new Date(event_date)
            : null,
      },
    })

    if (parsed.data.status === 'closed' && existing.status !== 'closed') {
      eventBus.emit('lead.closed', { lead_id: updated.id, band_id: updated.band_id })
      // Inline: cria evento de produção sem depender do instrumentationHook
      const existingEvent = await prisma.event.findUnique({ where: { lead_id: updated.id } })
      if (!existingEvent) {
        if (!updated.event_date) {
          console.warn(`Lead ${updated.id} fechado sem data de evento — evento não criado.`)
        } else {
          const event = await prisma.event.create({
            data: {
              band_id:         updated.band_id,
              lead_id:         updated.id,
              client_name:     updated.client_name,
              event_type:      updated.event_type,
              event_date:      updated.event_date,
              venue_name:      updated.venue_name ?? 'A definir',
              venue_address:   updated.city ?? undefined,
              venue_has_sound: updated.venue_has_sound,
              venue_has_light: updated.venue_has_light,
              value:           updated.budget ?? 0,
              status:          'contracted',
              notes:           updated.observations ?? undefined,
            },
          })
          const defaultItems = getDefaultChecklist(updated.event_type)
          await prisma.checklist.create({
            data: {
              event_id: event.id,
              title: 'Checklist Operacional',
              items: { create: defaultItems.map(d => ({ description: d.description, done: false })) },
            },
          })
          console.log(`Evento ${event.id} criado para lead ${updated.id}`)
        }
      }
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PATCH lead error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await prisma.lead.findUnique({
    where: { id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    // Apaga evento vinculado (e em cascata: contratos, checklists, músicos)
    const event = await prisma.event.findUnique({ where: { lead_id: id } })
    if (event) {
      await prisma.document.deleteMany({ where: { event_id: event.id } })
      await prisma.event.delete({ where: { id: event.id } })
    }
    await prisma.message.deleteMany({ where: { lead_id: id } })
    await prisma.document.deleteMany({ where: { lead_id: id } })
    await prisma.lead.delete({ where: { id } })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    console.error('DELETE lead error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
