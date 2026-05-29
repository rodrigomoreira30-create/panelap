import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { uploadUrlSchema } from '@/lib/validations/document'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = uploadUrlSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  if (parsed.data.event_id) {
    const event = await prisma.event.findUnique({
      where: { id: parsed.data.event_id, band_id: sessionUser.band_id },
    })
    if (!event) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  const ext = parsed.data.file_name.split('.').pop() ?? 'bin'
  const storagePath = `${sessionUser.band_id}/${parsed.data.event_id ?? 'general'}/${Date.now()}.${ext}`

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await serviceSupabase.storage
    .from('documents')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    return NextResponse.json({ error: 'Falha ao gerar URL de upload' }, { status: 500 })
  }

  const { data: publicData } = serviceSupabase.storage
    .from('documents')
    .getPublicUrl(storagePath)

  return NextResponse.json({
    data: {
      signed_url:   data.signedUrl,
      token:        data.token,
      storage_path: storagePath,
      file_url:     publicData.publicUrl,
    },
  })
}
