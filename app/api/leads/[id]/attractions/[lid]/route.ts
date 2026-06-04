import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadAttractionUpdateSchema } from '@/lib/validations/attraction'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lid: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: leadId, lid } = await params

  const existing = await prisma.leadAttraction.findFirst({
    where: { id: lid, lead: { id: leadId, band_id: sessionUser.band_id } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = leadAttractionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const updated = await prisma.leadAttraction.update({
      where: { id: lid },
      data: parsed.data,
    })
    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PATCH lead attraction error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; lid: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: leadId, lid } = await params

  const existing = await prisma.leadAttraction.findFirst({
    where: { id: lid, lead: { id: leadId, band_id: sessionUser.band_id } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await prisma.leadAttraction.delete({ where: { id: lid } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE lead attraction error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
