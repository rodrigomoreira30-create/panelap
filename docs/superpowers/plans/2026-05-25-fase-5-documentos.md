# PanelAp — Fase 5: Módulo de Documentos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o módulo de documentos com upload para Supabase Storage, organização por evento e tipo, visualização inline de PDFs e download seguro.

**Architecture:** Upload direto para Supabase Storage via signed upload URL (evita expor credenciais no client). A API route gera o signed URL, o client faz o upload direto ao Storage, depois confirma à API que salve o registro no banco. PDFs exibidos inline via signed download URL.

**Tech Stack:** Next.js 14, Prisma, Supabase Storage, Vitest.

**Pré-requisito:** Fases 0–4 completas. Bucket `documents` criado no Supabase (Fase 0).

---

## Mapa de Arquivos

```
app/
├── (dashboard)/[bandSlug]/documentos/
│   └── page.tsx                        # Lista de documentos + upload
├── api/
│   └── documents/
│       ├── route.ts                    # GET lista, POST registrar após upload
│       ├── upload-url/
│       │   └── route.ts                # POST gerar signed upload URL
│       └── [id]/
│           ├── route.ts                # DELETE documento
│           └── download/
│               └── route.ts            # GET gerar signed download URL
components/documentos/
├── DocumentList.tsx
├── DocumentUpload.tsx
└── PDFViewer.tsx
lib/
└── validations/
    └── document.ts
```

---

## Task 1: Validação e API de Documentos

**Files:**
- Create: `lib/validations/document.ts`
- Create: `app/api/documents/route.ts`
- Create: `app/api/documents/upload-url/route.ts`
- Create: `app/api/documents/[id]/route.ts`
- Create: `app/api/documents/[id]/download/route.ts`

- [ ] **Step 1: Criar `lib/validations/document.ts`**

```typescript
import { z } from 'zod'

const documentTypes = ['contract', 'rider', 'briefing', 'map', 'other'] as const

export const documentRegisterSchema = z.object({
  file_name:  z.string().min(1),
  file_url:   z.string().url(),
  type:       z.enum(documentTypes),
  event_id:   z.string().cuid().optional(),
})

export const uploadUrlSchema = z.object({
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  event_id:  z.string().cuid().optional(),
})

export type DocumentRegisterInput = z.infer<typeof documentRegisterSchema>
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>
```

- [ ] **Step 2: Criar `app/api/documents/upload-url/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { uploadUrlSchema } from '@/lib/validations/document'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = uploadUrlSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Verificar que event_id (se fornecido) pertence à banda
  if (parsed.data.event_id) {
    const event = await prisma.event.findUnique({
      where: { id: parsed.data.event_id, band_id: sessionUser.band_id },
    })
    if (!event) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // Gerar caminho único no Storage
  const ext = parsed.data.file_name.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const storagePath = `${sessionUser.band_id}/${parsed.data.event_id ?? 'general'}/${timestamp}.${ext}`

  // Usar service role para gerar signed upload URL
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

  // A URL pública do arquivo após o upload
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
```

- [ ] **Step 3: Criar `app/api/documents/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { documentRegisterSchema } from '@/lib/validations/document'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('event_id')
  const type = searchParams.get('type')

  const documents = await prisma.document.findMany({
    where: {
      band_id: sessionUser.band_id,
      ...(eventId ? { event_id: eventId } : {}),
      ...(type ? { type: type as any } : {}),
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
```

- [ ] **Step 4: Criar `app/api/documents/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.document.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Extrair caminho do Storage da URL
  const url = new URL(doc.file_url)
  const storagePath = url.pathname.split('/documents/')[1]

  if (storagePath) {
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await serviceSupabase.storage.from('documents').remove([storagePath])
  }

  await prisma.document.delete({ where: { id: params.id } })
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 5: Criar `app/api/documents/[id]/download/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.document.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
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
    .createSignedUrl(storagePath, 300) // 5 minutos

  if (error || !data) {
    return NextResponse.json({ error: 'Falha ao gerar URL de download' }, { status: 500 })
  }

  return NextResponse.json({ data: { url: data.signedUrl } })
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/validations/document.ts app/api/documents/
git commit -m "feat: API de documentos com upload via signed URL, lista, delete e download"
```

---

## Task 2: Componentes do Módulo de Documentos

**Files:**
- Create: `components/documentos/DocumentUpload.tsx`
- Create: `components/documentos/DocumentList.tsx`
- Create: `components/documentos/PDFViewer.tsx`

- [ ] **Step 1: Criar `components/documentos/DocumentUpload.tsx`**

```typescript
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload } from 'lucide-react'

const typeLabels = [
  { value: 'contract', label: 'Contrato' },
  { value: 'rider',    label: 'Rider Técnico' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'map',      label: 'Mapa / Planta' },
  { value: 'other',    label: 'Outro' },
]

interface DocumentUploadProps {
  eventId?: string
  onSuccess?: () => void
}

export function DocumentUpload({ eventId, onSuccess }: DocumentUploadProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setProgress(10)

    try {
      // 1. Obter signed upload URL
      const urlRes = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          mime_type: file.type,
          event_id:  eventId,
        }),
      })

      if (!urlRes.ok) throw new Error('Falha ao obter URL de upload')

      const { data: uploadData } = await urlRes.json()
      setProgress(30)

      // 2. Upload direto para o Supabase Storage
      const uploadRes = await fetch(uploadData.signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) throw new Error('Falha no upload do arquivo')
      setProgress(70)

      // 3. Registrar documento no banco
      const registerRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          file_url:  uploadData.file_url,
          type,
          event_id: eventId,
        }),
      })

      if (!registerRes.ok) throw new Error('Falha ao registrar documento')
      setProgress(100)

      onSuccess?.()
      router.refresh()

      // Reset
      setTimeout(() => setProgress(0), 1000)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeLabels.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} className="mr-2" />
          {uploading ? `Enviando... ${progress}%` : 'Selecionar arquivo'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {progress > 0 && progress < 100 && (
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar `components/documentos/PDFViewer.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Download } from 'lucide-react'

interface PDFViewerProps {
  documentId: string
  fileName: string
}

export function PDFViewer({ documentId, fileName }: PDFViewerProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadUrl() {
    setLoading(true)
    const res = await fetch(`/api/documents/${documentId}/download`)
    if (res.ok) {
      const { data } = await res.json()
      setUrl(data.url)
    }
    setLoading(false)
  }

  if (!url) {
    return (
      <Button variant="ghost" size="sm" onClick={loadUrl} disabled={loading}>
        <ExternalLink size={14} className="mr-1" />
        {loading ? 'Carregando...' : 'Visualizar'}
      </Button>
    )
  }

  const isPdf = fileName.toLowerCase().endsWith('.pdf')

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <a href={url} download={fileName}>
          <Button variant="outline" size="sm">
            <Download size={14} className="mr-1" /> Download
          </Button>
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink size={14} className="mr-1" /> Abrir
          </Button>
        </a>
      </div>
      {isPdf && (
        <iframe
          src={url}
          className="w-full h-[600px] border rounded"
          title={fileName}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar `components/documentos/DocumentList.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PDFViewer } from './PDFViewer'
import { Trash2, FileText } from 'lucide-react'
import type { Document, User, Event } from '@/types'

const typeLabels: Record<string, string> = {
  contract: 'Contrato', rider: 'Rider', briefing: 'Briefing',
  map: 'Mapa', other: 'Outro',
}

type DocumentWithRelations = Document & {
  uploader: Pick<User, 'id' | 'name'>
  event: Pick<Event, 'id' | 'client_name'> | null
}

interface DocumentListProps {
  documents: DocumentWithRelations[]
  canDelete?: boolean
}

export function DocumentList({ documents, canDelete }: DocumentListProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FileText size={32} className="mx-auto mb-2 opacity-40" />
        <p>Nenhum documento ainda.</p>
      </div>
    )
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este documento?')) return
    setDeleting(id)
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    router.refresh()
    setDeleting(null)
  }

  return (
    <div className="divide-y">
      {documents.map(doc => (
        <div key={doc.id} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              <div>
                <button
                  className="text-sm font-medium hover:underline text-left"
                  onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                >
                  {doc.file_name}
                </button>
                <p className="text-xs text-gray-400">
                  {doc.event ? `${doc.event.client_name} · ` : ''}
                  {doc.uploader.name} ·{' '}
                  {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {typeLabels[doc.type] ?? doc.type}
              </Badge>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:text-red-600"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deleting === doc.id}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
          {expandedId === doc.id && (
            <div className="pl-6">
              <PDFViewer documentId={doc.id} fileName={doc.file_name} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/documentos/
git commit -m "feat: componentes de documentos (upload, lista, PDF viewer)"
```

---

## Task 3: Página de Documentos

**Files:**
- Create: `app/(dashboard)/[bandSlug]/documentos/page.tsx`

- [ ] **Step 1: Criar `app/(dashboard)/[bandSlug]/documentos/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentList } from '@/components/documentos/DocumentList'
import { DocumentUpload } from '@/components/documentos/DocumentUpload'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const typeLabels = [
  { value: '',         label: 'Todos os tipos' },
  { value: 'contract', label: 'Contratos' },
  { value: 'rider',    label: 'Riders' },
  { value: 'briefing', label: 'Briefings' },
  { value: 'map',      label: 'Mapas' },
  { value: 'other',    label: 'Outros' },
]

export default async function DocumentosPage({
  params,
  searchParams,
}: {
  params: { bandSlug: string }
  searchParams: { type?: string; event?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  // Roles que não podem ver documentos: musician
  if (dbUser.role === 'musician') redirect(`/${params.bandSlug}`)

  const documents = await prisma.document.findMany({
    where: {
      band_id: dbUser.band_id,
      ...(searchParams.type ? { type: searchParams.type as any } : {}),
      ...(searchParams.event ? { event_id: searchParams.event } : {}),
    },
    include: {
      uploader: { select: { id: true, name: true } },
      event:    { select: { id: true, client_name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  const canDelete = ['admin', 'commercial'].includes(dbUser.role)

  return (
    <div className="space-y-6">
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
          <FilterForm currentType={searchParams.type ?? ''} />
        </div>
        <DocumentList documents={documents} canDelete={canDelete} />
      </div>
    </div>
  )
}

// Client wrapper para o filtro
function FilterForm({ currentType }: { currentType: string }) {
  // Server Component não pode ter state — extrair para client component
  return null // placeholder, ver abaixo
}
```

- [ ] **Step 2: Criar `components/documentos/DocumentFilter.tsx`** (client component para o filtro)

```typescript
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const typeOptions = [
  { value: 'all',      label: 'Todos os tipos' },
  { value: 'contract', label: 'Contratos' },
  { value: 'rider',    label: 'Riders' },
  { value: 'briefing', label: 'Briefings' },
  { value: 'map',      label: 'Mapas' },
  { value: 'other',    label: 'Outros' },
]

export function DocumentFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentType = searchParams.get('type') ?? 'all'

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('type')
    } else {
      params.set('type', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select value={currentType} onValueChange={handleChange}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {typeOptions.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 3: Atualizar página para usar `DocumentFilter`**

```typescript
// app/(dashboard)/[bandSlug]/documentos/page.tsx
// Substituir o import de Select pelo DocumentFilter:
import { DocumentFilter } from '@/components/documentos/DocumentFilter'

// E substituir o FilterForm placeholder no JSX por:
<DocumentFilter />
```

Página final:

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentList } from '@/components/documentos/DocumentList'
import { DocumentUpload } from '@/components/documentos/DocumentUpload'
import { DocumentFilter } from '@/components/documentos/DocumentFilter'

export default async function DocumentosPage({
  params,
  searchParams,
}: {
  params: { bandSlug: string }
  searchParams: { type?: string; event?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  if (dbUser.role === 'musician') redirect(`/${params.bandSlug}`)

  const documents = await prisma.document.findMany({
    where: {
      band_id: dbUser.band_id,
      ...(searchParams.type ? { type: searchParams.type as any } : {}),
      ...(searchParams.event ? { event_id: searchParams.event } : {}),
    },
    include: {
      uploader: { select: { id: true, name: true } },
      event:    { select: { id: true, client_name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  const canDelete = ['admin', 'commercial'].includes(dbUser.role)

  return (
    <div className="space-y-6">
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
          <DocumentFilter />
        </div>
        <DocumentList documents={documents} canDelete={canDelete} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/ components/documentos/
git commit -m "feat: página de documentos com upload, lista, filtro e PDF viewer"
```

---

## Task 4: Verificação Final do Módulo de Documentos

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: sem erros TypeScript.

- [ ] **Step 3: Testar fluxo completo**

1. Navegar para `/documentos`
2. Selecionar tipo "Rider" e clicar em "Selecionar arquivo"
3. Fazer upload de um PDF e verificar que aparece na lista
4. Clicar no arquivo para expandir e usar o PDFViewer
5. Testar download
6. Testar filtro por tipo
7. Testar delete (somente admin/commercial)
8. Verificar que contratos assinados criados pelo webhook ZapSign aparecem automaticamente

- [ ] **Step 4: Commit final da fase**

```bash
git add .
git commit -m "feat: Fase 5 completa — Módulo de Documentos com upload seguro, lista e PDF viewer"
```

---

## Checklist da Fase 5

- [ ] API de signed upload URL funcionando
- [ ] Upload direto ao Supabase Storage via cliente
- [ ] Registro do documento no banco após upload
- [ ] API de lista com filtros por tipo e evento
- [ ] API de delete (remove do Storage + banco)
- [ ] API de download com signed URL (5 min)
- [ ] `DocumentUpload` com progress bar
- [ ] `DocumentList` com expand para visualização
- [ ] `PDFViewer` com iframe inline para PDFs
- [ ] `DocumentFilter` com filtro por tipo via URL
- [ ] Proteção de rota: músicos não acessam `/documentos`
- [ ] Todos os testes passando

**Próximo:** [Fase 6 — Agentes IA](./2026-05-25-fase-6-agentes-ia.md)
