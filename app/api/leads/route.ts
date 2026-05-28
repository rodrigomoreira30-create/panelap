import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadCreateSchema } from '@/lib/validations/lead'
import { eventBus } from '@/lib/events/internal-bus'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const VALID_STATUSES = ['new_lead', 'attending', 'proposal_sent', 'negotiation', 'closed', 'lost']
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const leads = await prisma.lead.findMany({
    where: {
      band_id: sessionUser.band_id,
      ...(status ? { status: status as any } : {}),
    },
    include: { assignee: { select: { id: true, name: true, avatar_url: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ data: leads })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = leadCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        ...parsed.data,
        band_id: sessionUser.band_id,
        event_date: parsed.data.event_date ? new Date(parsed.data.event_date) : undefined,
      },
    })
    return NextResponse.json({ data: lead }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
