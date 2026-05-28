import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadUpdateSchema } from '@/lib/validations/lead'
import { eventBus } from '@/lib/events/internal-bus'

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

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...parsed.data,
      event_date: parsed.data.event_date ? new Date(parsed.data.event_date) : undefined,
    },
  })

  if (parsed.data.status === 'closed' && existing.status !== 'closed') {
    eventBus.emit('lead.closed', { lead_id: updated.id, band_id: updated.band_id })
  }

  return NextResponse.json({ data: updated })
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

  await prisma.lead.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
