import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(
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

  const url = new URL(doc.file_url)
  const storagePath = url.pathname.split('/documents/')[1]

  if (!storagePath) return NextResponse.json({ error: 'Path inválido' }, { status: 400 })

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await serviceSupabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 300)

  if (error || !data) {
    return NextResponse.json({ error: 'Falha ao gerar URL de download' }, { status: 500 })
  }

  return NextResponse.json({ data: { url: data.signedUrl } })
}
