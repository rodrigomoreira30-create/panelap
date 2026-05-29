import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const doc = await prisma.document.findUnique({
    where: { id, band_id: sessionUser.band_id },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Extract storage path from URL
  const url = new URL(doc.file_url)
  const storagePath = url.pathname.split('/documents/')[1]

  if (storagePath) {
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await serviceSupabase.storage.from('documents').remove([storagePath])
  }

  await prisma.document.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
