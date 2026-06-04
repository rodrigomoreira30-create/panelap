import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadAttractionCreateSchema } from '@/lib/validations/attraction'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: leadId } = await params

  const lead = await prisma.lead.findUnique({
    where: { id: leadId, band_id: sessionUser.band_id },
    select: { proposal_discount: true },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await prisma.leadAttraction.findMany({
    where: { lead_id: leadId },
    orderBy: { created_at: 'asc' },
  })

  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.custom_value.toString()), 0)
  const discount = parseFloat(lead.proposal_discount?.toString() ?? '0')
  const total = Math.max(0, subtotal - discount)

  return NextResponse.json({ data: { items, subtotal, discount, total } })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: leadId } = await params

  const lead = await prisma.lead.findUnique({
    where: { id: leadId, band_id: sessionUser.band_id },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = leadAttractionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const attraction = await prisma.attraction.findUnique({
    where: { id: parsed.data.attraction_id, band_id: sessionUser.band_id, is_active: true },
  })
  if (!attraction) {
    return NextResponse.json({ error: 'Atração não encontrada ou inativa' }, { status: 404 })
  }

  try {
    const leadAttraction = await prisma.leadAttraction.create({
      data: {
        lead_id:      leadId,
        attraction_id: parsed.data.attraction_id,
        name:         attraction.name,
        custom_value: parsed.data.custom_value,
        observations: parsed.data.observations ?? null,
      },
    })
    return NextResponse.json({ data: leadAttraction }, { status: 201 })
  } catch (err) {
    console.error('POST lead attraction error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
