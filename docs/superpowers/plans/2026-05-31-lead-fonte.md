# Lead Fonte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar campo `source` (Fonte) aos leads com opções configuráveis (Indicação, Redes Sociais, Tráfego Pago), exibindo-o no Kanban card e permitindo edição no painel de detalhes.

**Architecture:** Campo `source: String?` no model `Lead` e `lead_sources: Json?` no model `Band`. Mesmo padrão de `pipeline_stages` / `PipelineSettings`. Sources fluem do Server Component via props até `LeadCard`, `LeadForm` e `LeadEditPanel`.

**Tech Stack:** Next.js 15 (App Router), Prisma, Zod, TanStack Query, shadcn/ui, Vitest

---

## Mapa de Arquivos

| Ação | Arquivo |
|---|---|
| Modificar | `lib/validations/lead.ts` |
| Modificar | `__tests__/api/leads.test.ts` |
| Modificar | `prisma/schema.prisma` |
| Criar | `app/api/settings/sources/route.ts` |
| Criar | `components/configuracoes/SourceSettings.tsx` |
| Modificar | `app/(dashboard)/[bandSlug]/configuracoes/page.tsx` |
| Modificar | `components/comercial/LeadCard.tsx` |
| Modificar | `components/comercial/KanbanColumn.tsx` |
| Modificar | `components/comercial/KanbanBoard.tsx` |
| Modificar | `components/comercial/LeadForm.tsx` |
| Modificar | `components/comercial/NewLeadButton.tsx` |
| Modificar | `app/(dashboard)/[bandSlug]/comercial/page.tsx` |
| Modificar | `components/comercial/LeadEditPanel.tsx` |
| Modificar | `app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx` |

---

## Task 1: Validação Zod — campo `source`

**Files:**
- Modify: `lib/validations/lead.ts`
- Modify: `__tests__/api/leads.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Substitua o conteúdo de `__tests__/api/leads.test.ts` por:

```ts
import { describe, it, expect } from 'vitest'
import { leadCreateSchema, leadUpdateSchema } from '@/lib/validations/lead'

describe('leadCreateSchema', () => {
  it('valida payload mínimo correto com source', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João Silva',
      phone: '11999999999',
      event_type: 'wedding',
      source: 'referral',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita payload sem source', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João Silva',
      phone: '11999999999',
      event_type: 'wedding',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita payload sem client_name', () => {
    const result = leadCreateSchema.safeParse({
      phone: '11999999999',
      event_type: 'wedding',
      source: 'referral',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita event_type inválido', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João',
      phone: '11999999999',
      event_type: 'invalid_type',
      source: 'referral',
    })
    expect(result.success).toBe(false)
  })
})

describe('leadUpdateSchema', () => {
  it('permite atualizar apenas o status', () => {
    const result = leadUpdateSchema.safeParse({ status: 'closed' })
    expect(result.success).toBe(true)
  })

  it('rejeita status inválido', () => {
    const result = leadUpdateSchema.safeParse({ status: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('permite atualizar source', () => {
    const result = leadUpdateSchema.safeParse({ source: 'social_media' })
    expect(result.success).toBe(true)
  })

  it('rejeita source como string vazia', () => {
    const result = leadUpdateSchema.safeParse({ source: '' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar testes para verificar que falham**

```bash
cd /Users/rodrigomoreira/Desktop/PanelAp
npm run test:run -- __tests__/api/leads.test.ts
```

Esperado: falha em "rejeita payload sem source", "valida payload mínimo correto com source", "permite atualizar source", "rejeita source como string vazia"

- [ ] **Step 3: Adicionar `source` aos schemas em `lib/validations/lead.ts`**

```ts
import { z } from 'zod'

const eventTypes = ['wedding', 'party', 'show', 'corporate', 'other'] as const

export const leadCreateSchema = z.object({
  client_name:     z.string().min(2, 'Nome obrigatório'),
  phone:           z.string().min(10, 'Telefone inválido'),
  event_type:      z.enum(eventTypes),
  source:          z.string().min(1, 'Fonte obrigatória'),
  event_date:      z.string().min(1).optional(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  venue_has_sound: z.boolean().optional().default(false),
  venue_has_light: z.boolean().optional().default(false),
  budget:          z.number().positive().optional(),
  assigned_to:     z.string().cuid().optional(),
  observations:    z.string().optional(),
  tags:            z.array(z.string().min(1).max(50)).optional(),
})

export const leadUpdateSchema = z.object({
  client_name:     z.string().min(2).optional(),
  phone:           z.string().min(10).optional(),
  event_type:      z.enum(eventTypes).optional(),
  source:          z.string().min(1).optional(),
  event_date:      z.string().min(1).optional().nullable(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  venue_has_sound: z.boolean().optional(),
  venue_has_light: z.boolean().optional(),
  budget:          z.number().positive().optional().nullable(),
  assigned_to:     z.string().cuid().optional().nullable(),
  status:          z.string().min(1).optional(),
  observations:    z.string().optional(),
  tags:            z.array(z.string().min(1).max(50)).optional(),
})

export type LeadCreateInput = z.infer<typeof leadCreateSchema>
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>
```

- [ ] **Step 4: Rodar testes para verificar que passam**

```bash
npm run test:run -- __tests__/api/leads.test.ts
```

Esperado: todos os 8 testes passando

- [ ] **Step 5: Commit**

```bash
git add lib/validations/lead.ts __tests__/api/leads.test.ts
git commit -m "feat: adiciona campo source nos schemas de criação e atualização de leads"
```

---

## Task 2: Migração Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao schema**

No model `Band` (após `pipeline_stages  Json?`):
```prisma
lead_sources     Json?
```

No model `Lead` (após `tags            Json       @default("[]")`):
```prisma
source          String?
```

O bloco `Lead` após a mudança fica:
```prisma
model Lead {
  id              String     @id @default(cuid())
  band_id         String
  client_name     String
  phone           String
  event_type      EventType
  event_date      DateTime?
  city            String?
  venue_name      String?
  venue_has_sound Boolean    @default(false)
  venue_has_light Boolean    @default(false)
  budget          Decimal?
  status          String     @default("new_lead")
  tags            Json       @default("[]")
  source          String?
  assigned_to     String?
  observations    String?
  created_at      DateTime   @default(now())
  updated_at      DateTime   @updatedAt

  band      Band       @relation(fields: [band_id], references: [id], onDelete: Cascade)
  assignee  User?      @relation("AssignedLeads", fields: [assigned_to], references: [id])
  messages  Message[]
  documents Document[]
  event     Event?

  @@index([band_id])
  @@index([assigned_to])
}
```

O bloco `Band` após a mudança fica:
```prisma
model Band {
  id               String   @id @default(cuid())
  name             String
  slug             String   @unique
  plan             SaasPlan @default(starter)
  logo_url         String?
  asaas_id         String?
  pipeline_stages  Json?
  lead_sources     Json?
  created_at       DateTime @default(now())

  users              User[]
  leads              Lead[]
  events             Event[]
  contract_templates ContractTemplate[]
  documents          Document[]
}
```

- [ ] **Step 2: Gerar e rodar a migração**

```bash
npx prisma migrate dev --name add_lead_source
```

Esperado: "Your database is now in sync with your schema."

- [ ] **Step 3: Verificar que os testes existentes continuam passando**

```bash
npm run test:run
```

Esperado: todos os testes passando

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: adiciona source ao Lead e lead_sources ao Band no schema"
```

---

## Task 3: API `/api/settings/sources`

**Files:**
- Create: `app/api/settings/sources/route.ts`

- [ ] **Step 1: Criar o arquivo da rota**

```ts
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const sourcesSchema = z.object({
  sources: z.array(z.object({
    key:   z.string().min(1).regex(/^[a-z0-9_]+$/),
    label: z.string().min(1).max(40),
  })).min(1),
})

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const band = await prisma.band.findUnique({
    where: { id: sessionUser.band_id },
    select: { lead_sources: true },
  })

  return NextResponse.json({ data: band?.lead_sources ?? null })
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  })
  if (dbUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = sourcesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const band = await prisma.band.update({
    where: { id: sessionUser.band_id },
    data: { lead_sources: parsed.data.sources },
    select: { lead_sources: true },
  })

  return NextResponse.json({ data: band.lead_sources })
}
```

- [ ] **Step 2: Verificar que o TypeScript compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros relacionados ao novo arquivo

- [ ] **Step 3: Commit**

```bash
git add app/api/settings/sources/route.ts
git commit -m "feat: adiciona rota GET/PATCH /api/settings/sources para fontes de lead"
```

---

## Task 4: Componente `SourceSettings`

**Files:**
- Create: `components/configuracoes/SourceSettings.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GripVertical, Trash2, Plus } from 'lucide-react'

type Source = { key: string; label: string }

const DEFAULT_SOURCES: Source[] = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]

interface SourceSettingsProps {
  initialSources: Source[] | null
}

export function SourceSettings({ initialSources }: SourceSettingsProps) {
  const router = useRouter()
  const [sources, setSources] = useState<Source[]>(initialSources ?? DEFAULT_SOURCES)
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  function updateLabel(index: number, label: string) {
    setSources(prev => prev.map((s, i) => i === index ? { ...s, label } : s))
  }

  function removeSource(index: number) {
    if (sources.length <= 1) return
    setSources(prev => prev.filter((_, i) => i !== index))
  }

  function addSource() {
    const key = `source_${Date.now()}`
    setSources(prev => [...prev, { key, label: 'Nova Fonte' }])
  }

  function onDragStart(index: number) {
    setDragIndex(index)
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const updated = [...sources]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, moved)
    setSources(updated)
    setDragIndex(index)
  }

  function onDragEnd() {
    setDragIndex(null)
  }

  async function handleSave() {
    const emptyLabel = sources.find(s => !s.label.trim())
    if (emptyLabel) { setError('Todas as fontes precisam de um nome.'); return }
    setError('')
    setSaving(true)
    const res = await fetch('/api/settings/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    })
    setSaving(false)
    if (res.ok) router.refresh()
    else setError('Erro ao salvar. Tente novamente.')
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Arraste para reordenar. Edite os nomes ou adicione novas fontes.
      </p>

      <div className="space-y-2">
        {sources.map((source, index) => (
          <div
            key={source.key}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={e => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-2 p-2 border rounded-lg bg-white transition-opacity ${dragIndex === index ? 'opacity-50' : ''}`}
          >
            <GripVertical size={16} className="text-gray-300 cursor-grab shrink-0" />
            <Input
              value={source.label}
              onChange={e => updateLabel(index, e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <button
              onClick={() => removeSource(index)}
              disabled={sources.length <= 1}
              className="text-gray-300 hover:text-red-500 disabled:opacity-20 transition-colors p-1"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addSource} className="w-full">
        <Plus size={14} className="mr-1" /> Adicionar fonte
      </Button>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Salvando...' : 'Salvar fontes'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros

- [ ] **Step 3: Commit**

```bash
git add components/configuracoes/SourceSettings.tsx
git commit -m "feat: componente SourceSettings para gerenciar fontes de lead"
```

---

## Task 5: Página de Configurações — seção Fontes de Lead

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/configuracoes/page.tsx`

- [ ] **Step 1: Adicionar import e busca de `lead_sources`**

No topo do arquivo, adicionar import:
```tsx
import { SourceSettings } from '@/components/configuracoes/SourceSettings'
```

Alterar a query do `band` para incluir `lead_sources`:
```tsx
const [members, band] = await Promise.all([
  prisma.user.findMany({
    where: { band_id: dbUser.band_id },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  }),
  prisma.band.findUnique({
    where: { id: dbUser.band_id },
    select: { pipeline_stages: true, lead_sources: true },
  }),
])
```

- [ ] **Step 2: Adicionar seção "Fontes de Lead" no JSX**

Após a seção `<section>` de "Etapas do Pipeline", adicionar:
```tsx
<section>
  <h2 className="text-lg font-semibold mb-3">Fontes de Lead</h2>
  <SourceSettings initialSources={band?.lead_sources as { key: string; label: string }[] | null} />
</section>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros

- [ ] **Step 4: Testar na UI**

Abrir `/{bandSlug}/configuracoes`. Verificar que a seção "Fontes de Lead" aparece com as três opções padrão. Testar adicionar, editar, reordenar e salvar.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/\[bandSlug\]/configuracoes/page.tsx
git commit -m "feat: adiciona seção Fontes de Lead na página de configurações"
```

---

## Task 6: `LeadCard` — exibir fonte

**Files:**
- Modify: `components/comercial/LeadCard.tsx`

- [ ] **Step 1: Adicionar `sources` ao tipo e prop de `LeadCard`**

Adicionar o tipo `Source` e atualizar a interface:
```tsx
type Source = { key: string; label: string }

interface LeadCardProps {
  lead: KanbanLead
  onClick: () => void
  onDelete?: (id: string) => void
  sources?: Source[]
}
```

- [ ] **Step 2: Exibir label da fonte no card**

Dentro de `<CardContent>`, após o bloco de `lead.tags`, adicionar:
```tsx
{lead.source && sources && (() => {
  const src = sources.find(s => s.key === lead.source)
  return src ? (
    <p className="text-xs text-gray-400">{src.label}</p>
  ) : null
})()}
```

O `CardContent` completo depois das mudanças:
```tsx
<CardContent className="p-3 space-y-2">
  <div className="flex items-start justify-between gap-1">
    <p className="font-medium text-sm leading-tight">{lead.client_name}</p>
    <div className="flex items-center gap-1 shrink-0">
      <Badge variant="secondary" className="text-xs">
        {eventTypeLabels[lead.event_type] ?? lead.event_type}
      </Badge>
      {onDelete && (
        <button
          onClick={e => {
            e.stopPropagation()
            if (confirm(`Apagar lead de ${lead.client_name}?`)) onDelete(lead.id)
          }}
          className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  </div>
  {lead.event_date && (
    <p className="text-xs text-gray-500">
      {(() => {
        const [y, m, d] = lead.event_date!.slice(0, 10).split('-').map(Number)
        return format(new Date(y, m - 1, d), "dd 'de' MMM yyyy", { locale: ptBR })
      })()}
    </p>
  )}
  {lead.city && (
    <p className="text-xs text-gray-400">{lead.city}</p>
  )}
  {lead.budget != null && (
    <p className="text-xs font-medium text-green-600">
      R$ {lead.budget.toLocaleString('pt-BR')}
    </p>
  )}
  {lead.tags && lead.tags.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-1">
      {lead.tags.slice(0, 3).map(tag => (
        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 leading-none">
          {tag}
        </span>
      ))}
      {lead.tags.length > 3 && (
        <span className="text-[10px] text-gray-400">+{lead.tags.length - 3}</span>
      )}
    </div>
  )}
  {lead.source && sources && (() => {
    const src = sources.find(s => s.key === lead.source)
    return src ? (
      <p className="text-xs text-gray-400">{src.label}</p>
    ) : null
  })()}
  {lead.assignee && (
    <div className="flex items-center gap-1 mt-1">
      <Avatar className="h-5 w-5">
        <AvatarFallback className="text-[10px]">
          {lead.assignee.name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-gray-500">{lead.assignee.name}</span>
    </div>
  )}
</CardContent>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros (a prop `sources` é opcional, então usos existentes sem ela continuam válidos)

- [ ] **Step 4: Commit**

```bash
git add components/comercial/LeadCard.tsx
git commit -m "feat: LeadCard exibe a fonte do lead"
```

---

## Task 7: `KanbanColumn` — threading de `sources`

**Files:**
- Modify: `components/comercial/KanbanColumn.tsx`

- [ ] **Step 1: Adicionar `sources` à interface e repassar para `LeadCard`**

O arquivo completo após a mudança:
```tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard } from './LeadCard'
import { Badge } from '@/components/ui/badge'
import type { KanbanLead } from './KanbanBoard'

type Source = { key: string; label: string }

const statusColors: Record<string, string> = {
  new_lead:      'bg-gray-100',
  attending:     'bg-blue-50',
  proposal_sent: 'bg-yellow-50',
  negotiation:   'bg-orange-50',
  closed:        'bg-green-50',
  lost:          'bg-red-50',
}

interface KanbanColumnProps {
  status: string
  label: string
  leads: KanbanLead[]
  sources: Source[]
  onLeadClick: (lead: KanbanLead) => void
  onLeadDelete: (id: string) => void
}

export function KanbanColumn({ status, label, leads, sources, onLeadClick, onLeadDelete }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <div className={`flex flex-col rounded-lg p-3 min-h-[400px] w-56 shrink-0 ${statusColors[status] ?? 'bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{label}</span>
        <Badge variant="outline" className="text-xs">{leads.length}</Badge>
      </div>
      <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2 flex-1">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              sources={sources}
              onClick={() => onLeadClick(lead)}
              onDelete={onLeadDelete}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: erro em `KanbanBoard.tsx` indicando que `sources` está faltando no uso de `<KanbanColumn>` — isso é esperado e será corrigido na próxima task.

- [ ] **Step 3: Commit**

```bash
git add components/comercial/KanbanColumn.tsx
git commit -m "feat: KanbanColumn recebe e repassa sources para LeadCard"
```

---

## Task 8: `KanbanBoard` — receber `leadSources` e propagar

**Files:**
- Modify: `components/comercial/KanbanBoard.tsx`

- [ ] **Step 1: Atualizar tipo `KanbanLead` com `source`**

No bloco `export type KanbanLead`, adicionar `source: string | null`:
```ts
export type KanbanLead = {
  id: string
  band_id: string
  client_name: string
  phone: string
  event_type: string
  event_date: string | null
  city: string | null
  venue_name: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  budget: number | null
  status: string
  source: string | null
  tags: string[]
  assigned_to: string | null
  observations: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; name: string; avatar_url: string | null } | null
}
```

- [ ] **Step 2: Adicionar tipo `Source` e `leadSources` à interface e defaultar**

```ts
type Source = { key: string; label: string }

const DEFAULT_SOURCES: Source[] = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]

interface KanbanBoardProps {
  bandSlug: string
  pipelineStages: Stage[] | null
  leadSources: Source[] | null
}
```

- [ ] **Step 3: Usar `sources` e passar para `KanbanColumn` e `LeadCard` no `DragOverlay`**

No corpo da função `KanbanBoard`, logo após `const stages = pipelineStages ?? DEFAULT_STAGES`, adicionar:
```ts
const sources = leadSources ?? DEFAULT_SOURCES
```

No render do `DragOverlay`, passar `sources`:
```tsx
<DragOverlay>
  {activeLead && <LeadCard lead={activeLead} onClick={() => {}} sources={sources} />}
</DragOverlay>
```

No render de cada `KanbanColumn`, passar `sources`:
```tsx
{stages.map(stage => (
  <KanbanColumn
    key={stage.key}
    status={stage.key}
    label={stage.label}
    leads={getLeadsByStatus(stage.key)}
    sources={sources}
    onLeadClick={lead => router.push(`/${bandSlug}/comercial/${lead.id}`)}
    onLeadDelete={id => deleteMutation.mutate(id)}
  />
))}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: erro em `comercial/page.tsx` indicando que `leadSources` está faltando — será corrigido na Task 11.

- [ ] **Step 5: Commit**

```bash
git add components/comercial/KanbanBoard.tsx
git commit -m "feat: KanbanBoard recebe leadSources e propaga sources para colunas e cards"
```

---

## Task 9: `LeadForm` — campo Fonte obrigatório

**Files:**
- Modify: `components/comercial/LeadForm.tsx`

- [ ] **Step 1: Adicionar tipo `Source` e prop `sources` ao componente**

O arquivo completo após a mudança:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Source = { key: string; label: string }

interface LeadFormProps {
  sources: Source[]
  onSuccess: () => void
  onCancel: () => void
}

export function LeadForm({ sources, onSuccess, onCancel }: LeadFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    client_name: '', phone: '', event_type: '', source: '',
    event_date: '', city: '', venue_name: '', budget: '',
    venue_has_sound: false, venue_has_light: false,
    observations: '',
  })

  function set(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget: form.budget ? parseFloat(form.budget) : undefined,
          event_date: form.event_date || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(typeof data.error === 'string' ? data.error : 'Erro ao criar lead')
        setLoading(false)
        return
      }

      setLoading(false)
      onSuccess()
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nome do cliente *</Label>
          <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} required />
        </div>
        <div>
          <Label>Telefone / WhatsApp *</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} required />
        </div>
        <div>
          <Label>Tipo de evento *</Label>
          <Select onValueChange={v => set('event_type', v)} required>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wedding">Casamento</SelectItem>
              <SelectItem value="party">Festa</SelectItem>
              <SelectItem value="show">Show</SelectItem>
              <SelectItem value="corporate">Corporativo</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fonte *</Label>
          <Select onValueChange={v => set('source', v)} required>
            <SelectTrigger><SelectValue placeholder="Selecione a fonte" /></SelectTrigger>
            <SelectContent>
              {sources.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data do evento</Label>
          <Input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} />
        </div>
        <div>
          <Label>Orçamento estimado (R$)</Label>
          <Input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <Label>Local do evento</Label>
          <Input value={form.venue_name} onChange={e => set('venue_name', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.venue_has_sound}
            onChange={e => set('venue_has_sound', e.target.checked)}
          />
          Local tem som
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.venue_has_light}
            onChange={e => set('venue_has_light', e.target.checked)}
          />
          Local tem luz
        </label>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea value={form.observations} onChange={e => set('observations', e.target.value)} />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Criar Lead'}</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: erro em `NewLeadButton.tsx` indicando que `sources` está faltando — será corrigido na próxima task.

- [ ] **Step 3: Commit**

```bash
git add components/comercial/LeadForm.tsx
git commit -m "feat: LeadForm recebe sources e exibe campo Fonte obrigatório"
```

---

## Task 10: `NewLeadButton` — repassar `sources`

**Files:**
- Modify: `components/comercial/NewLeadButton.tsx`

- [ ] **Step 1: Adicionar prop `sources` e repassar para `LeadForm`**

O arquivo completo após a mudança:
```tsx
'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { LeadForm } from './LeadForm'

type Source = { key: string; label: string }

interface NewLeadButtonProps {
  sources: Source[]
}

export function NewLeadButton({ sources }: NewLeadButtonProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  function handleSuccess() {
    setOpen(false)
    queryClient.invalidateQueries({ queryKey: ['leads'] })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus size={16} className="mr-2" />Novo Lead</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Criar novo lead</DialogTitle></DialogHeader>
        <LeadForm sources={sources} onSuccess={handleSuccess} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: erro em `comercial/page.tsx` indicando que `sources` está faltando em `<NewLeadButton>` — será corrigido na próxima task.

- [ ] **Step 3: Commit**

```bash
git add components/comercial/NewLeadButton.tsx
git commit -m "feat: NewLeadButton recebe e passa sources para LeadForm"
```

---

## Task 11: Página Comercial — buscar e distribuir `lead_sources`

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/comercial/page.tsx`

- [ ] **Step 1: Buscar `lead_sources` e passar para `NewLeadButton` e `KanbanBoard`**

O arquivo completo após a mudança:
```tsx
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/comercial/KanbanBoard'
import { NewLeadButton } from '@/components/comercial/NewLeadButton'

const DEFAULT_SOURCES = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]

export default async function ComercialPage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['leads', bandSlug],
    queryFn: async () => {
      const leads = await prisma.lead.findMany({
        where: { band_id: dbUser.band_id },
        include: { assignee: { select: { id: true, name: true, avatar_url: true } } },
        orderBy: { created_at: 'desc' },
      })
      return leads.map(l => ({
        ...l,
        budget: l.budget ? parseFloat(l.budget.toString()) : null,
        event_date: l.event_date ? l.event_date.toISOString() : null,
        created_at: l.created_at.toISOString(),
        updated_at: l.updated_at.toISOString(),
      }))
    },
  })

  const band = await prisma.band.findUnique({
    where: { id: dbUser.band_id },
    select: { pipeline_stages: true, lead_sources: true },
  })

  const pipelineStages = (band?.pipeline_stages as { key: string; label: string }[] | null) ?? null
  const leadSources = (band?.lead_sources as { key: string; label: string }[] | null) ?? DEFAULT_SOURCES

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Comercial</h1>
            <p className="text-gray-500 text-sm">Pipeline de leads e oportunidades</p>
          </div>
          <NewLeadButton sources={leadSources} />
        </div>
        <KanbanBoard
          bandSlug={bandSlug}
          pipelineStages={pipelineStages}
          leadSources={leadSources}
        />
      </div>
    </HydrationBoundary>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros

- [ ] **Step 3: Testar na UI**

Abrir `/{bandSlug}/comercial`. Verificar que:
- Botão "Novo Lead" abre o modal com o campo "Fonte *"
- Os leads existentes no kanban não quebram (cards aparecem normalmente)
- Criar um novo lead com fonte funciona — lead aparece no card com a fonte exibida

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/\[bandSlug\]/comercial/page.tsx
git commit -m "feat: página comercial busca lead_sources e distribui para NewLeadButton e KanbanBoard"
```

---

## Task 12: `LeadEditPanel` — campo Fonte no painel de detalhes

**Files:**
- Modify: `components/comercial/LeadEditPanel.tsx`

- [ ] **Step 1: Adicionar `source` ao tipo `LeadData`, form state e prop `sources`**

Atualizar a interface `LeadData`:
```ts
interface LeadData {
  id: string
  client_name: string
  phone: string
  event_type: string
  event_date: string | null
  city: string | null
  venue_name: string | null
  budget: number | null
  venue_has_sound: boolean
  venue_has_light: boolean
  observations: string | null
  status: string
  source: string | null
  tags: string[]
  assignee: { id: string; name: string } | null
}
```

Atualizar a interface `LeadEditPanelProps`:
```ts
type Source = { key: string; label: string }

interface LeadEditPanelProps {
  lead: LeadData
  stages: Stage[]
  sources: Source[]
}
```

- [ ] **Step 2: Adicionar `source` ao form state e funções**

No `useState` do form:
```ts
const [form, setForm] = useState({
  client_name:     lead.client_name,
  phone:           lead.phone,
  event_date:      toDateInput(lead.event_date),
  city:            lead.city ?? '',
  venue_name:      lead.venue_name ?? '',
  budget:          lead.budget != null ? String(lead.budget) : '',
  venue_has_sound: lead.venue_has_sound,
  venue_has_light: lead.venue_has_light,
  observations:    lead.observations ?? '',
  source:          lead.source ?? '',
})
```

Em `handleCancel`, adicionar `source` ao reset:
```ts
function handleCancel() {
  setForm({
    client_name:     displayed.client_name,
    phone:           displayed.phone,
    event_date:      toDateInput(displayed.event_date),
    city:            displayed.city ?? '',
    venue_name:      displayed.venue_name ?? '',
    budget:          displayed.budget != null ? String(displayed.budget) : '',
    venue_has_sound: displayed.venue_has_sound,
    venue_has_light: displayed.venue_has_light,
    observations:    displayed.observations ?? '',
    source:          displayed.source ?? '',
  })
  setError('')
  setEditing(false)
}
```

Em `handleSave`, adicionar `source` no body e no `setDisplayed`:
```ts
async function handleSave() {
  setSaving(true)
  setError('')
  const res = await fetch(`/api/leads/${lead.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name:     form.client_name,
      phone:           form.phone,
      event_date:      form.event_date || null,
      city:            form.city || null,
      venue_name:      form.venue_name || null,
      budget:          form.budget ? parseFloat(form.budget) : null,
      venue_has_sound: form.venue_has_sound,
      venue_has_light: form.venue_has_light,
      observations:    form.observations || null,
      source:          form.source || null,
    }),
  })
  setSaving(false)
  if (res.ok) {
    setDisplayed(prev => ({
      ...prev,
      client_name:     form.client_name,
      phone:           form.phone,
      event_date:      form.event_date || null,
      city:            form.city || null,
      venue_name:      form.venue_name || null,
      budget:          form.budget ? parseFloat(form.budget) : null,
      venue_has_sound: form.venue_has_sound,
      venue_has_light: form.venue_has_light,
      observations:    form.observations || null,
      source:          form.source || null,
    }))
    setEditing(false)
    router.refresh()
  } else {
    setError('Erro ao salvar. Tente novamente.')
  }
}
```

- [ ] **Step 3: Adicionar campo Fonte ao JSX (view + edit mode)**

Nos imports, adicionar `Select, SelectContent, SelectItem, SelectTrigger, SelectValue`:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
```

No JSX, após o campo `Tipo:` e antes do campo `Data do evento:`, adicionar:
```tsx
<div>
  <span className="font-medium">Fonte:</span>{' '}
  {editing ? (
    <Select value={form.source} onValueChange={v => set('source', v)}>
      <SelectTrigger className="mt-1 h-8 text-sm">
        <SelectValue placeholder="Selecione a fonte" />
      </SelectTrigger>
      <SelectContent>
        {sources.map(s => (
          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (() => {
    const src = sources.find(s => s.key === displayed.source)
    return src ? <span>{src.label}</span> : <span className="text-gray-400">Não informada</span>
  })()}
</div>
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: erro em `[leadId]/page.tsx` porque `sources` está faltando no `<LeadEditPanel>` — será corrigido na próxima task.

- [ ] **Step 5: Commit**

```bash
git add components/comercial/LeadEditPanel.tsx
git commit -m "feat: LeadEditPanel exibe e permite editar a fonte do lead"
```

---

## Task 13: Página de Detalhe do Lead — passar `sources` para `LeadEditPanel`

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx`

- [ ] **Step 1: Buscar `lead_sources` e passar para `LeadEditPanel`**

O arquivo completo após a mudança:
```tsx
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MessageThread } from '@/components/comercial/MessageThread'
import { LeadEditPanel } from '@/components/comercial/LeadEditPanel'
import { LeadDocuments } from '@/components/comercial/LeadDocuments'

const DEFAULT_STAGES = [
  { key: 'new_lead',      label: 'Novo Lead' },
  { key: 'attending',     label: 'Em Atendimento' },
  { key: 'proposal_sent', label: 'Proposta Enviada' },
  { key: 'negotiation',   label: 'Negociação' },
  { key: 'closed',        label: 'Fechado' },
  { key: 'lost',          label: 'Perdido' },
]

const DEFAULT_SOURCES = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ bandSlug: string; leadId: string }>
}) {
  const { leadId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const [lead, band] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId, band_id: dbUser.band_id },
      include: {
        messages: { orderBy: { sent_at: 'asc' } },
        assignee: { select: { id: true, name: true } },
        documents: { orderBy: { created_at: 'desc' } },
      },
    }),
    prisma.band.findUnique({
      where: { id: dbUser.band_id },
      select: { pipeline_stages: true, lead_sources: true },
    }),
  ])

  if (!lead) notFound()

  const stages = (band?.pipeline_stages as { key: string; label: string }[] | null) ?? DEFAULT_STAGES
  const sources = (band?.lead_sources as { key: string; label: string }[] | null) ?? DEFAULT_SOURCES

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0 space-y-4 overflow-y-auto pr-1">
        <LeadEditPanel
          lead={{
            id:              lead.id,
            client_name:     lead.client_name,
            phone:           lead.phone,
            event_type:      lead.event_type,
            event_date:      lead.event_date ? lead.event_date.toISOString() : null,
            city:            lead.city,
            venue_name:      lead.venue_name,
            budget:          lead.budget ? parseFloat(lead.budget.toString()) : null,
            venue_has_sound: lead.venue_has_sound,
            venue_has_light: lead.venue_has_light,
            observations:    lead.observations,
            status:          lead.status,
            source:          lead.source,
            tags:            (lead.tags as string[]) ?? [],
            assignee:        lead.assignee,
          }}
          stages={stages}
          sources={sources}
        />

        <div className="border-t pt-4">
          <LeadDocuments
            leadId={lead.id}
            initialDocs={lead.documents.map(d => ({
              id: d.id,
              file_name: d.file_name,
              file_url: d.file_url,
              created_at: d.created_at.toISOString(),
            }))}
          />
        </div>
      </div>
      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b bg-gray-50">
          <h3 className="font-medium text-sm">Histórico de Mensagens</h3>
        </div>
        <MessageThread leadId={lead.id} messages={lead.messages as any} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript sem erros**

```bash
npx tsc --noEmit
```

Esperado: sem erros

- [ ] **Step 3: Rodar todos os testes**

```bash
npm run test:run
```

Esperado: todos os testes passando

- [ ] **Step 4: Testar na UI — fluxo completo**

1. Abrir `/{bandSlug}/configuracoes` — verificar seção "Fontes de Lead" com drag-to-reorder e salvar
2. Abrir `/{bandSlug}/comercial` — criar novo lead com fonte selecionada
3. Verificar que o card no Kanban exibe a fonte
4. Clicar no lead → painel lateral — verificar que "Fonte" aparece em modo view
5. Clicar "Editar" — verificar Select de Fonte com a opção atual selecionada
6. Mudar a fonte e salvar — verificar que a nova fonte aparece no view mode

- [ ] **Step 5: Commit final**

```bash
git add app/(dashboard)/\[bandSlug\]/comercial/\[leadId\]/page.tsx
git commit -m "feat: página de detalhe do lead passa sources para LeadEditPanel"
```
