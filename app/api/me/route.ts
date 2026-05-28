import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: user.id },
    include: { band: { select: { slug: true } } },
  })

  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ bandSlug: dbUser.band.slug })
}
