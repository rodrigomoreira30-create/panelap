import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const docs = await prisma.document.findMany({
    where: { lead_id: id, band_id: sessionUser.band_id },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ data: docs })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: leadId } = await params

  const lead = await prisma.lead.findUnique({ where: { id: leadId, band_id: sessionUser.band_id } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${sessionUser.band_id}/leads/${leadId}/${Date.now()}.${ext}`

  const supabase = adminClient()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

  const doc = await prisma.document.create({
    data: {
      band_id: sessionUser.band_id,
      lead_id: leadId,
      type: 'other',
      file_url: publicUrl,
      file_name: file.name,
      uploaded_by: sessionUser.id,
    },
  })

  return NextResponse.json({ data: doc }, { status: 201 })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: leadId } = await params
  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })

  const doc = await prisma.document.findUnique({
    where: { id: docId, band_id: sessionUser.band_id, lead_id: leadId },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Remove from storage
  const supabase = adminClient()
  const urlPath = new URL(doc.file_url).pathname
  const storagePath = urlPath.split('/storage/v1/object/public/documents/')[1]
  if (storagePath) {
    await supabase.storage.from('documents').remove([storagePath])
  }

  await prisma.document.delete({ where: { id: docId } })
  return NextResponse.json({ ok: true })
}
