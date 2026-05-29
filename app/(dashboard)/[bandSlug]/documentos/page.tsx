import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { DocumentList } from '@/components/documentos/DocumentList'
import { DocumentUpload } from '@/components/documentos/DocumentUpload'
import { DocumentFilter } from '@/components/documentos/DocumentFilter'
import { DocumentType } from '@/lib/generated/prisma/client'

const VALID_TYPES = ['contract', 'rider', 'briefing', 'map', 'other']

export default async function DocumentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandSlug: string }>
  searchParams: Promise<{ type?: string; event?: string }>
}) {
  const { bandSlug } = await params
  const { type, event: eventId } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  // Validate band membership
  const band = await prisma.band.findUnique({ where: { slug: bandSlug }, select: { id: true } })
  if (!band || band.id !== dbUser.band_id) return notFound()

  // Musicians cannot access documents
  if (dbUser.role === 'musician') redirect(`/${bandSlug}`)

  const documents = await prisma.document.findMany({
    where: {
      band_id: dbUser.band_id,
      ...(type && VALID_TYPES.includes(type) ? { type: type as DocumentType } : {}),
      ...(eventId ? { event_id: eventId } : {}),
    },
    include: {
      uploader: { select: { id: true, name: true } },
      event: { select: { id: true, client_name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  const canDelete = ['admin', 'commercial'].includes(dbUser.role)

  // Map to DocumentItem shape — uploader.name may be null in DB but DocumentList expects string
  const documentItems = documents.map(doc => ({
    ...doc,
    uploader: {
      id: doc.uploader.id,
      name: doc.uploader.name ?? '',
    },
  }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-gray-500 text-sm">Central de arquivos da banda</p>
        </div>
        <DocumentUpload />
      </div>
      <div className="border rounded-lg bg-white">
        <div className="p-3 border-b bg-gray-50 flex gap-2 items-center">
          <span className="text-sm text-gray-500">Filtrar:</span>
          <Suspense fallback={null}>
            <DocumentFilter />
          </Suspense>
        </div>
        <DocumentList documents={documentItems} canDelete={canDelete} />
      </div>
    </div>
  )
}
