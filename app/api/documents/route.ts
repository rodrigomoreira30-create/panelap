import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { documentRegisterSchema } from '@/lib/validations/document'
import { DocumentType } from '@/lib/generated/prisma/client'

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('event_id')
  const type = searchParams.get('type')

  const VALID_TYPES = ['contract', 'rider', 'briefing', 'map', 'other']

  const documents = await prisma.document.findMany({
    where: {
      band_id: sessionUser.band_id,
      ...(eventId ? { event_id: eventId } : {}),
      ...(type && VALID_TYPES.includes(type) ? { type: type as DocumentType } : {}),
    },
    include: {
      uploader: { select: { id: true, name: true } },
      event:    { select: { id: true, client_name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ data: documents })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = documentRegisterSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const document = await prisma.document.create({
    data: {
      band_id:     sessionUser.band_id,
      event_id:    parsed.data.event_id ?? null,
      type:        parsed.data.type,
      file_url:    parsed.data.file_url,
      file_name:   parsed.data.file_name,
      uploaded_by: sessionUser.id,
    },
    include: { uploader: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ data: document }, { status: 201 })
}
