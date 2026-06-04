import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { attractionCreateSchema } from '@/lib/validations/attraction'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const attractions = await prisma.attraction.findMany({
    where: { band_id: sessionUser.band_id },
    orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json({ data: attractions })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = attractionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const attraction = await prisma.attraction.create({
    data: { ...parsed.data, band_id: sessionUser.band_id },
  })

  return NextResponse.json({ data: attraction }, { status: 201 })
}
