import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { templateCreateSchema } from '@/lib/validations/contract'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({
    where: { supabase_id: user.id },
    select: { band_id: true },
  })
}

export async function GET(_request: Request) {
  const dbUser = await getSessionUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.contractTemplate.findMany({
    where: { band_id: dbUser.band_id },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ data: templates })
}

export async function POST(request: Request) {
  const dbUser = await getSessionUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = templateCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, content, is_default } = parsed.data
  const band_id = dbUser.band_id

  if (is_default) {
    await prisma.contractTemplate.updateMany({
      where: { band_id, is_default: true },
      data: { is_default: false },
    })
  }

  const template = await prisma.contractTemplate.create({
    data: {
      band_id,
      name,
      content,
      is_default: is_default ?? false,
    },
  })

  return NextResponse.json({ data: template }, { status: 201 })
}
