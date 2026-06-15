import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fullUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true, band_id: true },
  })
  if (!fullUser || fullUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (id === sessionUser.id) {
    return NextResponse.json({ error: 'Você não pode remover a si mesmo' }, { status: 400 })
  }

  const target = await prisma.user.findFirst({
    where: { id, band_id: fullUser.band_id },
    select: { id: true, supabase_id: true },
  })
  if (!target) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await prisma.user.delete({ where: { id } })
  await supabase.auth.admin.deleteUser(target.supabase_id).catch(() => {})

  return NextResponse.json({ ok: true })
}
