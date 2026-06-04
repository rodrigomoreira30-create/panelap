# Atrações Contratadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Atrações Contratadas" section inside each lead page that lets sellers pick contracted attractions from a band catalog, set per-client prices, and see the proposal total with a fixed discount.

**Architecture:** Two new Prisma models (`Attraction` for the band catalog, `LeadAttraction` for per-lead associations with value snapshot). The lead detail sidebar becomes a 3-tab panel (Dados / Atrações / Docs). The attractions catalog is managed by admins in Configurações.

**Tech Stack:** Next.js App Router, Prisma + PostgreSQL (Supabase), Zod validation, Vitest, React client components with local optimistic state.

---

## File Map

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `lib/validations/attraction.ts` |
| Create | `__tests__/api/attractions.test.ts` |
| Create | `app/api/attractions/route.ts` |
| Create | `app/api/attractions/[id]/route.ts` |
| Create | `app/api/leads/[id]/attractions/route.ts` |
| Create | `app/api/leads/[id]/attractions/[lid]/route.ts` |
| Modify | `lib/validations/lead.ts` |
| Modify | `app/api/leads/[id]/route.ts` |
| Create | `components/configuracoes/AttractionSettings.tsx` |
| Create | `components/comercial/LeadAttractions.tsx` |
| Modify | `components/comercial/LeadEditPanel.tsx` |
| Modify | `app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx` |
| Modify | `app/(dashboard)/[bandSlug]/configuracoes/page.tsx` |

---

## Task 1: Prisma Schema — New Models + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Attraction and LeadAttraction models to schema**

In `prisma/schema.prisma`, add the following two models and update `Band` and `Lead`:

```prisma
// Add to Band model (after lead_sources Json? field):
attractions  Attraction[]

// Add to Lead model (after updated_at DateTime @updatedAt):
proposal_discount Decimal?        @default(0)
lead_attractions  LeadAttraction[]

// New models at end of file:
model Attraction {
  id            String   @id @default(cuid())
  band_id       String
  name          String
  category      String?
  description   String?
  default_value Decimal  @default(0)
  is_active     Boolean  @default(true)
  created_at    DateTime @default(now())

  band             Band             @relation(fields: [band_id], references: [id], onDelete: Cascade)
  lead_attractions LeadAttraction[]

  @@index([band_id])
}

model LeadAttraction {
  id            String   @id @default(cuid())
  lead_id       String
  attraction_id String?
  name          String
  custom_value  Decimal
  observations  String?
  created_at    DateTime @default(now())

  lead       Lead        @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  attraction Attraction? @relation(fields: [attraction_id], references: [id], onDelete: SetNull)

  @@index([lead_id])
}
```

- [ ] **Step 2: Generate migration and regenerate Prisma client**

```bash
npx prisma migrate dev --name add-attractions
npx prisma generate
```

Expected: migration applied successfully, no errors. A new migration file appears in `prisma/migrations/`.

- [ ] **Step 3: Verify TypeScript picks up new types**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors related to Attraction or LeadAttraction.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Attraction and LeadAttraction Prisma models"
```

---

## Task 2: Validation Schemas

**Files:**
- Create: `lib/validations/attraction.ts`

- [ ] **Step 1: Create validation schemas**

Create `lib/validations/attraction.ts`:

```typescript
import { z } from 'zod'

export const attractionCreateSchema = z.object({
  name:          z.string().min(1, 'Nome obrigatório').max(100),
  category:      z.string().max(50).optional(),
  description:   z.string().max(500).optional(),
  default_value: z.number().min(0).default(0),
})

export const attractionUpdateSchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  category:      z.string().max(50).optional().nullable(),
  description:   z.string().max(500).optional().nullable(),
  default_value: z.number().min(0).optional(),
  is_active:     z.boolean().optional(),
})

export const leadAttractionCreateSchema = z.object({
  attraction_id: z.string().cuid(),
  custom_value:  z.number().min(0),
  observations:  z.string().max(500).optional(),
})

export const leadAttractionUpdateSchema = z.object({
  custom_value:  z.number().min(0).optional(),
  observations:  z.string().max(500).optional().nullable(),
})

export type AttractionCreateInput = z.infer<typeof attractionCreateSchema>
export type AttractionUpdateInput = z.infer<typeof attractionUpdateSchema>
export type LeadAttractionCreateInput = z.infer<typeof leadAttractionCreateSchema>
export type LeadAttractionUpdateInput = z.infer<typeof leadAttractionUpdateSchema>
```

- [ ] **Step 2: Commit**

```bash
git add lib/validations/attraction.ts
git commit -m "feat: add Zod validation schemas for attractions"
```

---

## Task 3: Tests for Validation Schemas

**Files:**
- Create: `__tests__/api/attractions.test.ts`

- [ ] **Step 1: Write tests**

Create `__tests__/api/attractions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  attractionCreateSchema,
  attractionUpdateSchema,
  leadAttractionCreateSchema,
  leadAttractionUpdateSchema,
} from '@/lib/validations/attraction'

describe('attractionCreateSchema', () => {
  it('valida payload mínimo com nome', () => {
    const result = attractionCreateSchema.safeParse({ name: 'Banda Sapo Brasilis' })
    expect(result.success).toBe(true)
  })

  it('rejeita nome vazio', () => {
    const result = attractionCreateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('valida payload completo', () => {
    const result = attractionCreateSchema.safeParse({
      name: 'DJ',
      category: 'DJ',
      description: 'DJ profissional',
      default_value: 2500,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita default_value negativo', () => {
    const result = attractionCreateSchema.safeParse({ name: 'DJ', default_value: -100 })
    expect(result.success).toBe(false)
  })
})

describe('attractionUpdateSchema', () => {
  it('permite atualizar apenas is_active', () => {
    const result = attractionUpdateSchema.safeParse({ is_active: false })
    expect(result.success).toBe(true)
  })

  it('permite atualizar apenas o nome', () => {
    const result = attractionUpdateSchema.safeParse({ name: 'Novo Nome' })
    expect(result.success).toBe(true)
  })

  it('rejeita nome vazio na atualização', () => {
    const result = attractionUpdateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('leadAttractionCreateSchema', () => {
  it('valida payload mínimo com attraction_id e custom_value', () => {
    const result = leadAttractionCreateSchema.safeParse({
      attraction_id: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      custom_value: 12800,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita attraction_id que não é cuid', () => {
    const result = leadAttractionCreateSchema.safeParse({
      attraction_id: 'not-a-cuid',
      custom_value: 12800,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita custom_value negativo', () => {
    const result = leadAttractionCreateSchema.safeParse({
      attraction_id: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      custom_value: -500,
    })
    expect(result.success).toBe(false)
  })
})

describe('leadAttractionUpdateSchema', () => {
  it('permite atualizar apenas custom_value', () => {
    const result = leadAttractionUpdateSchema.safeParse({ custom_value: 14000 })
    expect(result.success).toBe(true)
  })

  it('permite zerar observations com null', () => {
    const result = leadAttractionUpdateSchema.safeParse({ observations: null })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run __tests__/api/attractions.test.ts
```

Expected: 10 passing tests.

- [ ] **Step 3: Commit**

```bash
git add __tests__/api/attractions.test.ts
git commit -m "test: add validation tests for attraction schemas"
```

---

## Task 4: API — GET/POST /api/attractions

**Files:**
- Create: `app/api/attractions/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/attractions/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { attractionCreateSchema } from '@/lib/validations/attraction'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const attractions = await prisma.attraction.findMany({
    where: { band_id: sessionUser.band_id },
    orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json({ data: attractions })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = attractionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const attraction = await prisma.attraction.create({
    data: { ...parsed.data, band_id: sessionUser.band_id },
  })

  return NextResponse.json({ data: attraction }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/attractions/route.ts
git commit -m "feat: add GET/POST /api/attractions route"
```

---

## Task 5: API — PATCH/DELETE /api/attractions/[id]

**Files:**
- Create: `app/api/attractions/[id]/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/attractions/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { attractionUpdateSchema } from '@/lib/validations/attraction'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.attraction.findUnique({
    where: { id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = attractionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const updated = await prisma.attraction.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.attraction.findUnique({
    where: { id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.attraction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/attractions/[id]/route.ts
git commit -m "feat: add PATCH/DELETE /api/attractions/[id] route"
```

---

## Task 6: API — GET/POST /api/leads/[id]/attractions

**Files:**
- Create: `app/api/leads/[id]/attractions/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/leads/[id]/attractions/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadAttractionCreateSchema } from '@/lib/validations/attraction'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: leadId } = await params

  const lead = await prisma.lead.findUnique({
    where: { id: leadId, band_id: sessionUser.band_id },
    select: { proposal_discount: true },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await prisma.leadAttraction.findMany({
    where: { lead_id: leadId },
    orderBy: { created_at: 'asc' },
  })

  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.custom_value.toString()), 0)
  const discount = parseFloat(lead.proposal_discount?.toString() ?? '0')
  const total = Math.max(0, subtotal - discount)

  return NextResponse.json({ data: { items, subtotal, discount, total } })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: leadId } = await params

  const lead = await prisma.lead.findUnique({
    where: { id: leadId, band_id: sessionUser.band_id },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = leadAttractionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const attraction = await prisma.attraction.findUnique({
    where: { id: parsed.data.attraction_id, band_id: sessionUser.band_id, is_active: true },
  })
  if (!attraction) {
    return NextResponse.json({ error: 'Atração não encontrada ou inativa' }, { status: 404 })
  }

  const leadAttraction = await prisma.leadAttraction.create({
    data: {
      lead_id:      leadId,
      attraction_id: parsed.data.attraction_id,
      name:         attraction.name,
      custom_value: parsed.data.custom_value,
      observations: parsed.data.observations ?? null,
    },
  })

  return NextResponse.json({ data: leadAttraction }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/leads/[id]/attractions/route.ts
git commit -m "feat: add GET/POST /api/leads/[id]/attractions route"
```

---

## Task 7: API — PATCH/DELETE /api/leads/[id]/attractions/[lid]

**Files:**
- Create: `app/api/leads/[id]/attractions/[lid]/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/leads/[id]/attractions/[lid]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadAttractionUpdateSchema } from '@/lib/validations/attraction'

async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lid: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: leadId, lid } = await params

  const existing = await prisma.leadAttraction.findFirst({
    where: { id: lid, lead: { id: leadId, band_id: sessionUser.band_id } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = leadAttractionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const updated = await prisma.leadAttraction.update({
    where: { id: lid },
    data: parsed.data,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; lid: string }> },
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: leadId, lid } = await params

  const existing = await prisma.leadAttraction.findFirst({
    where: { id: lid, lead: { id: leadId, band_id: sessionUser.band_id } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.leadAttraction.delete({ where: { id: lid } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/leads/[id]/attractions/[lid]/route.ts
git commit -m "feat: add PATCH/DELETE /api/leads/[id]/attractions/[lid] route"
```

---

## Task 8: Update Lead Schema + PATCH handler for proposal_discount

**Files:**
- Modify: `lib/validations/lead.ts`
- Modify: `app/api/leads/[id]/route.ts`

- [ ] **Step 1: Add proposal_discount to leadUpdateSchema**

In `lib/validations/lead.ts`, add `proposal_discount` to `leadUpdateSchema`. Add after the `tags` line:

```typescript
  proposal_discount: z.number().min(0).optional().nullable(),
```

- [ ] **Step 2: Verify the PATCH handler spreads the new field correctly**

Open `app/api/leads/[id]/route.ts`. The current handler destructures `{ tags, event_date, ...rest }` and spreads `rest` into the Prisma update. Since `proposal_discount` is not in the destructure list, it will be included in `rest` automatically — no change needed to the handler body.

Run TypeScript check to verify no errors:

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Run existing lead tests to make sure nothing broke**

```bash
npx vitest run __tests__/api/leads.test.ts
```

Expected: all passing (the new optional field doesn't break existing tests).

- [ ] **Step 4: Commit**

```bash
git add lib/validations/lead.ts
git commit -m "feat: add proposal_discount to lead update schema"
```

---

## Task 9: Component — AttractionSettings (Configurações)

**Files:**
- Create: `components/configuracoes/AttractionSettings.tsx`

- [ ] **Step 1: Create the component**

Create `components/configuracoes/AttractionSettings.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Check, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Attraction = {
  id: string
  name: string
  category: string | null
  description: string | null
  default_value: number
  is_active: boolean
}

interface AttractionSettingsProps {
  initialAttractions: Attraction[]
}

type EditForm = {
  name: string
  category: string
  description: string
  default_value: string
}

export function AttractionSettings({ initialAttractions }: AttractionSettingsProps) {
  const router = useRouter()
  const [attractions, setAttractions] = useState<Attraction[]>(initialAttractions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', category: '', description: '', default_value: '' })
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<EditForm>({ name: '', category: '', description: '', default_value: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit(a: Attraction) {
    setEditingId(a.id)
    setEditForm({
      name: a.name,
      category: a.category ?? '',
      description: a.description ?? '',
      default_value: String(a.default_value),
    })
  }

  async function handleSave(id: string) {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/attractions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        category: editForm.category || null,
        description: editForm.description || null,
        default_value: parseFloat(editForm.default_value) || 0,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const { data } = await res.json()
      setAttractions(prev => prev.map(a => a.id === id ? { ...a, ...data, default_value: parseFloat(data.default_value.toString()) } : a))
      setEditingId(null)
    } else {
      setError('Erro ao salvar.')
    }
  }

  async function handleToggleActive(a: Attraction) {
    const res = await fetch(`/api/attractions/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !a.is_active }),
    })
    if (res.ok) {
      setAttractions(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta atração do catálogo? Leads existentes não serão afetados.')) return
    const res = await fetch(`/api/attractions/${id}`, { method: 'DELETE' })
    if (res.ok) setAttractions(prev => prev.filter(a => a.id !== id))
  }

  async function handleCreate() {
    if (!newForm.name.trim()) { setError('Nome obrigatório.'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/attractions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newForm.name,
        category: newForm.category || undefined,
        description: newForm.description || undefined,
        default_value: parseFloat(newForm.default_value) || 0,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const { data } = await res.json()
      setAttractions(prev => [...prev, { ...data, default_value: parseFloat(data.default_value.toString()) }])
      setNewForm({ name: '', category: '', description: '', default_value: '' })
      setShowNew(false)
    } else {
      setError('Erro ao criar atração.')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Atrações cadastradas ficam disponíveis para seleção nos leads.
      </p>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="space-y-2">
        {attractions.map(a => (
          <div
            key={a.id}
            className={`flex items-center gap-2 p-3 border rounded-lg bg-white transition-opacity ${!a.is_active ? 'opacity-60' : ''}`}
          >
            {editingId === a.id ? (
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="h-8 text-sm col-span-2"
                  placeholder="Nome"
                />
                <Input
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Categoria"
                />
                <Input
                  type="number"
                  value={editForm.default_value}
                  onChange={e => setEditForm(f => ({ ...f, default_value: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Valor padrão"
                />
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-xs text-gray-400">
                  {a.category ?? '—'} · R$ {a.default_value.toLocaleString('pt-BR')}
                </div>
              </div>
            )}

            {editingId === a.id ? (
              <div className="flex gap-1 shrink-0">
                <Button size="sm" onClick={() => handleSave(a.id)} disabled={saving}>
                  <Check size={13} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                  <X size={13} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggleActive(a)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    a.is_active
                      ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'
                      : 'text-gray-400 border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {a.is_active ? 'ativo' : 'inativo'}
                </button>
                <button onClick={() => startEdit(a)} className="text-gray-400 hover:text-indigo-600 transition-colors p-1">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showNew ? (
        <div className="border border-dashed border-indigo-300 rounded-lg p-3 space-y-2 bg-indigo-50/30">
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newForm.name}
              onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              className="h-8 text-sm col-span-2"
              placeholder="Nome da atração *"
            />
            <Input
              value={newForm.category}
              onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
              className="h-8 text-sm"
              placeholder="Categoria"
            />
            <Input
              type="number"
              value={newForm.default_value}
              onChange={e => setNewForm(f => ({ ...f, default_value: e.target.value }))}
              className="h-8 text-sm"
              placeholder="Valor padrão (R$)"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving} className="flex-1">
              {saving ? 'Salvando...' : 'Criar atração'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setError('') }}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowNew(true)} className="w-full">
          <Plus size={14} className="mr-1" /> Nova atração
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/configuracoes/AttractionSettings.tsx
git commit -m "feat: add AttractionSettings component for catalog management"
```

---

## Task 10: Component — LeadAttractions (Aba no Lead)

**Files:**
- Create: `components/comercial/LeadAttractions.tsx`

- [ ] **Step 1: Create the component**

Create `components/comercial/LeadAttractions.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type LeadAttractionItem = {
  id: string
  name: string
  custom_value: number
  observations: string | null
}

type CatalogAttraction = {
  id: string
  name: string
  category: string | null
  default_value: number
  is_active: boolean
}

interface LeadAttractionsProps {
  leadId: string
  initialAttractions: LeadAttractionItem[]
  initialDiscount: number
}

export function LeadAttractions({ leadId, initialAttractions, initialDiscount }: LeadAttractionsProps) {
  const [items, setItems] = useState<LeadAttractionItem[]>(initialAttractions)
  const [discount, setDiscount] = useState(initialDiscount)
  const [discountInput, setDiscountInput] = useState(String(initialDiscount))
  const [catalog, setCatalog] = useState<CatalogAttraction[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [addValue, setAddValue] = useState('')
  const [addObs, setAddObs] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/attractions')
      .then(r => r.json())
      .then(({ data }) => {
        setCatalog((data as CatalogAttraction[]).filter(a => a.is_active))
      })
      .catch(() => {})
  }, [])

  function onCatalogSelect(id: string) {
    setSelectedId(id)
    const found = catalog.find(a => a.id === id)
    if (found) setAddValue(String(found.default_value))
  }

  async function handleAdd() {
    if (!selectedId) { setError('Selecione uma atração.'); return }
    const val = parseFloat(addValue)
    if (isNaN(val) || val < 0) { setError('Valor inválido.'); return }
    setAdding(true)
    setError('')
    const res = await fetch(`/api/leads/${leadId}/attractions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attraction_id: selectedId, custom_value: val, observations: addObs || undefined }),
    })
    setAdding(false)
    if (res.ok) {
      const { data } = await res.json()
      setItems(prev => [...prev, { ...data, custom_value: parseFloat(data.custom_value.toString()) }])
      setShowAdd(false)
      setSelectedId('')
      setAddValue('')
      setAddObs('')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Erro ao adicionar.')
    }
  }

  async function handleValueBlur(item: LeadAttractionItem, rawValue: string) {
    const val = parseFloat(rawValue)
    if (isNaN(val) || val === item.custom_value) return
    const res = await fetch(`/api/leads/${leadId}/attractions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_value: val }),
    })
    if (res.ok) {
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, custom_value: val } : x))
    }
  }

  async function handleObsBlur(item: LeadAttractionItem, obs: string) {
    const normalized = obs || null
    if (normalized === item.observations) return
    await fetch(`/api/leads/${leadId}/attractions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observations: normalized }),
    })
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, observations: normalized } : x))
  }

  async function handleRemove(id: string) {
    const res = await fetch(`/api/leads/${leadId}/attractions/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(x => x.id !== id))
  }

  async function handleDiscountBlur() {
    const val = parseFloat(discountInput)
    const safeVal = isNaN(val) || val < 0 ? 0 : val
    if (safeVal === discount) return
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_discount: safeVal }),
    })
    if (res.ok) {
      setDiscount(safeVal)
      setDiscountInput(String(safeVal))
    }
  }

  const subtotal = items.reduce((s, i) => s + i.custom_value, 0)
  const total = Math.max(0, subtotal - discount)

  function fmt(n: number) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="space-y-3 py-1">
      {items.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400">Nenhuma atração adicionada.</p>
      )}

      {items.map(item => (
        <AttractionRow
          key={item.id}
          item={item}
          onValueBlur={handleValueBlur}
          onObsBlur={handleObsBlur}
          onRemove={handleRemove}
        />
      ))}

      {showAdd ? (
        <div className="border border-dashed border-indigo-300 rounded-lg p-3 space-y-2 bg-indigo-50/30">
          <Select value={selectedId} onValueChange={onCatalogSelect}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Selecione a atração..." />
            </SelectTrigger>
            <SelectContent>
              {catalog.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}{a.category ? ` · ${a.category}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={addValue}
            onChange={e => setAddValue(e.target.value)}
            className="h-8 text-sm"
            placeholder="Valor (R$)"
          />
          <Textarea
            value={addObs}
            onChange={e => setAddObs(e.target.value)}
            className="text-sm min-h-[56px] resize-none"
            placeholder="Observações (opcional)"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={adding} className="flex-1">
              {adding ? <Loader2 size={13} className="animate-spin" /> : 'Confirmar'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setError('') }}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border border-dashed border-indigo-300 rounded-lg py-2 text-xs text-indigo-500 hover:bg-indigo-50 transition-colors font-medium flex items-center justify-center gap-1"
        >
          <Plus size={13} /> Adicionar atração
        </button>
      )}

      {/* Totais */}
      <div className="border-t pt-3 space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Subtotal</span>
          <span>{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Desconto</span>
          <Input
            type="number"
            value={discountInput}
            onChange={e => setDiscountInput(e.target.value)}
            onBlur={handleDiscountBlur}
            className="h-7 w-28 text-right text-xs"
            placeholder="0"
          />
        </div>
        <div className="flex justify-between items-center text-sm font-bold text-gray-900 pt-1 border-t">
          <span>Total da Proposta</span>
          <span className="text-indigo-600">{fmt(total)}</span>
        </div>
      </div>
    </div>
  )
}

function AttractionRow({
  item,
  onValueBlur,
  onObsBlur,
  onRemove,
}: {
  item: LeadAttractionItem
  onValueBlur: (item: LeadAttractionItem, raw: string) => void
  onObsBlur: (item: LeadAttractionItem, obs: string) => void
  onRemove: (id: string) => void
}) {
  const [value, setValue] = useState(String(item.custom_value))
  const [obs, setObs] = useState(item.observations ?? '')

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.name}</div>
        </div>
        <button onClick={() => onRemove(item.id)} className="text-gray-300 hover:text-red-500 transition-colors p-0.5 shrink-0">
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">Valor (R$)</span>
        <Input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => onValueBlur(item, value)}
          className="h-7 text-sm flex-1"
        />
      </div>
      <Textarea
        value={obs}
        onChange={e => setObs(e.target.value)}
        onBlur={() => onObsBlur(item, obs)}
        placeholder="Observações..."
        className="text-xs min-h-[48px] resize-none text-gray-500"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/comercial/LeadAttractions.tsx
git commit -m "feat: add LeadAttractions component with inline editing and totals"
```

---

## Task 11: Refactor LeadEditPanel — Sidebar com 3 Abas

**Files:**
- Modify: `components/comercial/LeadEditPanel.tsx`

- [ ] **Step 1: Read the full current file to understand what will be wrapped**

The current `LeadEditPanel` renders: header (name/phone), LeadStatusSelect, TagsInput, and all the lead data fields. After refactoring, this becomes the "Dados" tab. "Atrações" and "Docs" tabs are new.

- [ ] **Step 2: Add new props to the interface and tab state**

At the top of `components/comercial/LeadEditPanel.tsx`, update the imports and interface. Add after existing imports:

```typescript
import { LeadAttractions } from './LeadAttractions'
import { LeadDocuments } from './LeadDocuments'
```

Update `LeadEditPanelProps` interface — add three new props:

```typescript
interface LeadEditPanelProps {
  lead: LeadData
  stages: Stage[]
  sources: Source[]
  initialDocs: { id: string; file_name: string; file_url: string; created_at: string }[]
  initialAttractions: { id: string; name: string; custom_value: number; observations: string | null }[]
  initialDiscount: number
}
```

- [ ] **Step 3: Add tab state and restructure the return**

Inside `LeadEditPanel`, add after the last existing `useState` declaration:

```typescript
const [tab, setTab] = useState<'dados' | 'atracoes' | 'docs'>('dados')
```

The current `return (` produces a `<div className="space-y-4">` at the root. Change the return so that root `<div>` becomes the "Dados" tab body. The full new return statement is:

```typescript
return (
  <div className="flex flex-col h-full">
    {/* Tab bar */}
    <div className="flex border-b shrink-0">
      {(['dados', 'atracoes', 'docs'] as const).map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            tab === t
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t === 'dados' ? 'Dados' : t === 'atracoes' ? 'Atrações' : 'Docs'}
        </button>
      ))}
    </div>

    <div className="flex-1 overflow-y-auto p-1 pt-3">
      {tab === 'dados' && (
        // ← Keep the current root <div className="space-y-4"> and ALL its children here,
        //   exactly as they are today. No change to the Dados tab content.
        <div className="space-y-4">
          {/* ... existing header, LeadStatusSelect, TagsInput, fields, editing form ... */}
        </div>
      )}
      {tab === 'atracoes' && (
        <LeadAttractions
          leadId={lead.id}
          initialAttractions={initialAttractions}
          initialDiscount={initialDiscount}
        />
      )}
      {tab === 'docs' && (
        <LeadDocuments leadId={lead.id} initialDocs={initialDocs} />
      )}
    </div>
  </div>
)
```

The implementation step is: wrap the existing `return (...)` body (the full `<div className="space-y-4">...</div>` JSX tree that currently is the only content returned) inside `{tab === 'dados' && (...)}`, then add the two new tab branches. Do not modify any JSX inside the Dados tab.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/comercial/LeadEditPanel.tsx
git commit -m "feat: refactor LeadEditPanel sidebar into Dados/Atrações/Docs tabs"
```

---

## Task 12: Update Lead Detail Page

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx`

- [ ] **Step 1: Add lead_attractions to the Prisma include**

In `app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx`, update the `prisma.lead.findUnique` call to include `lead_attractions`:

```typescript
const [lead, band] = await Promise.all([
  prisma.lead.findUnique({
    where: { id: leadId, band_id: dbUser.band_id },
    include: {
      messages: { orderBy: { sent_at: 'asc' } },
      assignee: { select: { id: true, name: true } },
      documents: { orderBy: { created_at: 'desc' } },
      lead_attractions: { orderBy: { created_at: 'asc' } },
    },
  }),
  prisma.band.findUnique({
    where: { id: dbUser.band_id },
    select: { pipeline_stages: true, lead_sources: true },
  }),
])
```

- [ ] **Step 2: Update the JSX to pass new props and remove the standalone LeadDocuments**

Replace the sidebar section:

```typescript
<div className="w-80 shrink-0 overflow-hidden flex flex-col border rounded-lg">
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
    initialDocs={lead.documents.map(d => ({
      id: d.id,
      file_name: d.file_name,
      file_url: d.file_url,
      created_at: d.created_at.toISOString(),
    }))}
    initialAttractions={lead.lead_attractions.map(a => ({
      id: a.id,
      name: a.name,
      custom_value: parseFloat(a.custom_value.toString()),
      observations: a.observations,
    }))}
    initialDiscount={parseFloat(lead.proposal_discount?.toString() ?? '0')}
  />
</div>
```

Remove the old `<div className="border-t pt-4"><LeadDocuments .../></div>` block that was below `LeadEditPanel`.

Also remove the `LeadDocuments` import from the top of the file since it's now used inside `LeadEditPanel`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/\[bandSlug\]/comercial/\[leadId\]/page.tsx
git commit -m "feat: update lead detail page to include attractions data and tab sidebar"
```

---

## Task 13: Update Configurações Page

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/configuracoes/page.tsx`

- [ ] **Step 1: Add attractions fetch to the Promise.all**

In `app/(dashboard)/[bandSlug]/configuracoes/page.tsx`, update the `Promise.all`:

```typescript
const [members, band, attractions] = await Promise.all([
  prisma.user.findMany({
    where: { band_id: dbUser.band_id },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  }),
  prisma.band.findUnique({
    where: { id: dbUser.band_id },
    select: { pipeline_stages: true, lead_sources: true },
  }),
  prisma.attraction.findMany({
    where: { band_id: dbUser.band_id },
    orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
  }),
])
```

- [ ] **Step 2: Add AttractionSettings section to the JSX**

Add the import at the top of the file:

```typescript
import { AttractionSettings } from '@/components/configuracoes/AttractionSettings'
```

Add a new `<section>` after the "Fontes de Lead" section in the return JSX:

```typescript
<section>
  <h2 className="text-lg font-semibold mb-3">Atrações Disponíveis</h2>
  <AttractionSettings
    initialAttractions={attractions.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      description: a.description,
      default_value: parseFloat(a.default_value.toString()),
      is_active: a.is_active,
    }))}
  />
</section>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (including the new attractions schema tests).

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/\[bandSlug\]/configuracoes/page.tsx
git commit -m "feat: add AttractionSettings section to configuracoes page"
```

---

## Task 14: End-to-End Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the Configurações flow (admin)**
  1. Log in as an admin user
  2. Navigate to Configurações
  3. Scroll to "Atrações Disponíveis"
  4. Create 2–3 attractions (e.g., "Banda Sapo Brasilis · Banda · R$ 12000", "DJ · DJ · R$ 2500")
  5. Toggle one to inactive — confirm it turns grey
  6. Edit the name of one — confirm it saves

- [ ] **Step 3: Test the Lead flow (commercial)**
  1. Navigate to any lead
  2. Confirm the sidebar now shows 3 tabs: Dados, Atrações, Docs
  3. Click "Atrações" tab
  4. Click "+ Adicionar atração" — confirm catalog dropdown shows active attractions
  5. Select an attraction — confirm the value field is pre-filled with the default
  6. Adjust the value and add an observation; click Confirmar
  7. Verify the attraction appears in the list and the subtotal updates
  8. Add a second attraction; confirm subtotal updates
  9. Enter a discount value, click outside — confirm total recalculates
  10. Remove an attraction with ✕ — confirm it disappears and subtotal updates
  11. Click "Docs" tab — confirm existing documents are still accessible
  12. Click "Dados" tab — confirm all lead data and edit still work

- [ ] **Step 4: Final commit if any adjustments were needed**

```bash
git add -p
git commit -m "fix: adjustments from smoke test"
```
