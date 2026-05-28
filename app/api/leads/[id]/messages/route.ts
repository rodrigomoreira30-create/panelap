import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ content: z.string().min(1) })

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 422 })

  const lead = await prisma.lead.findUnique({
    where: { id, band_id: sessionUser.band_id },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const message = await prisma.message.create({
      data: {
        lead_id: id,
        direction: 'out',
        content: parsed.data.content,
        sent_by: sessionUser.name,
      },
    })
    return NextResponse.json({ data: message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
