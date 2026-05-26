# PanelAp — Fase 3: Módulo de Produção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o módulo de produção com criação automática de evento ao fechar lead, checklists operacionais, gestão de demandas técnicas, equipe por evento e comentários internos.

**Architecture:** O event bus escuta `lead.closed` e cria o `Event` com dados herdados do `Lead`. Também emite `event.created` para o módulo de Agenda. Checklists são gerados com itens padrão por tipo de evento. A equipe é gerenciada por `EventMusician`.

**Tech Stack:** Next.js 14, Prisma, Zod, Vitest.

**Pré-requisito:** Fases 0, 1 e 2 completas.

---

## Mapa de Arquivos

```
app/
├── (dashboard)/[bandSlug]/producao/
│   ├── page.tsx                        # Lista de eventos em produção
│   └── [eventoId]/
│       └── page.tsx                    # Detalhe do evento (checklists, equipe)
├── api/
│   ├── events/
│   │   ├── route.ts                    # GET lista de eventos
│   │   └── [id]/
│   │       └── route.ts                # GET, PATCH detalhe do evento
│   ├── checklists/
│   │   └── [id]/
│   │       └── items/
│   │           └── route.ts            # PATCH item (marcar done)
│   └── event-musicians/
│       └── route.ts                    # POST adicionar músico ao evento
components/producao/
├── EventCard.tsx
├── EventList.tsx
├── ChecklistPanel.tsx
├── ChecklistItemRow.tsx
└── TeamPanel.tsx
lib/
├── production/
│   ├── on-lead-closed.ts              # Listener cria Event + checklists
│   └── default-checklists.ts         # Itens padrão por tipo de evento
└── validations/
    └── event.ts
__tests__/lib/
└── default-checklists.test.ts
```

---

## Task 1: Checklists Padrão por Tipo de Evento

**Files:**
- Create: `lib/production/default-checklists.ts`
- Create: `__tests__/lib/default-checklists.test.ts`

- [ ] **Step 1: Escrever o teste**

```typescript
// __tests__/lib/default-checklists.test.ts
import { describe, it, expect } from 'vitest'
import { getDefaultChecklist } from '@/lib/production/default-checklists'

describe('getDefaultChecklist', () => {
  it('retorna itens para casamento', () => {
    const items = getDefaultChecklist('wedding')
    expect(items.length).toBeGreaterThan(3)
    expect(items.every(i => typeof i.description === 'string')).toBe(true)
  })

  it('retorna itens para show', () => {
    const items = getDefaultChecklist('show')
    expect(items.length).toBeGreaterThan(0)
  })

  it('retorna lista genérica para tipo desconhecido', () => {
    const items = getDefaultChecklist('unknown_type')
    expect(items.length).toBeGreaterThan(0)
  })

  it('todos os itens têm description não vazia', () => {
    const items = getDefaultChecklist('corporate')
    items.forEach(item => {
      expect(item.description.trim().length).toBeGreaterThan(0)
    })
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npx vitest run __tests__/lib/default-checklists.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/production/default-checklists'`

- [ ] **Step 3: Criar `lib/production/default-checklists.ts`**

```typescript
interface ChecklistItemTemplate {
  description: string
}

const WEDDING_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Confirmar horário de entrada com organizador' },
  { description: 'Confirmar horário de saída' },
  { description: 'Verificar estrutura de som do local' },
  { description: 'Verificar estrutura de luz do local' },
  { description: 'Confirmar playlist com os noivos' },
  { description: 'Confirmar músicas especiais (entrada, valsa)' },
  { description: 'Levar rider técnico para visita' },
  { description: 'Confirmar equipe escalada' },
  { description: 'Reservar transporte dos equipamentos' },
  { description: 'Confirmar alimentação da equipe com organizador' },
  { description: 'Verificar estacionamento para carga/descarga' },
]

const SHOW_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Confirmar abertura de portas e horário do show' },
  { description: 'Enviar rider técnico para o produtor local' },
  { description: 'Confirmar passagem de som (soundcheck)' },
  { description: 'Verificar camarim disponível' },
  { description: 'Confirmar equipe de palco (roadies locais)' },
  { description: 'Confirmar setlist final' },
  { description: 'Verificar projeção/telões (se aplicável)' },
  { description: 'Confirmar backline (se incluso no contrato)' },
  { description: 'Reservar transporte da banda e equipamentos' },
]

const CORPORATE_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Receber briefing completo do evento' },
  { description: 'Confirmar repertório adequado ao perfil corporativo' },
  { description: 'Verificar sala/palco disponível' },
  { description: 'Confirmar horário de montagem' },
  { description: 'Confirmar tempo de apresentação' },
  { description: 'Verificar estrutura de som do local' },
  { description: 'Confirmar contato do produtor do evento' },
]

const PARTY_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Confirmar horário de início e encerramento' },
  { description: 'Verificar estrutura de som do local' },
  { description: 'Confirmar repertório com o cliente' },
  { description: 'Confirmar equipe escalada' },
  { description: 'Reservar transporte dos equipamentos' },
  { description: 'Verificar acesso ao local para carga' },
]

const GENERIC_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Confirmar horário e data com o cliente' },
  { description: 'Confirmar local e endereço' },
  { description: 'Verificar necessidades técnicas' },
  { description: 'Confirmar equipe escalada' },
  { description: 'Organizar transporte e logística' },
]

const CHECKLISTS: Record<string, ChecklistItemTemplate[]> = {
  wedding:   WEDDING_CHECKLIST,
  show:      SHOW_CHECKLIST,
  corporate: CORPORATE_CHECKLIST,
  party:     PARTY_CHECKLIST,
  other:     GENERIC_CHECKLIST,
}

export function getDefaultChecklist(eventType: string): ChecklistItemTemplate[] {
  return CHECKLISTS[eventType] ?? GENERIC_CHECKLIST
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

```bash
npx vitest run __tests__/lib/default-checklists.test.ts
```

Esperado: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/production/default-checklists.ts __tests__/lib/default-checklists.test.ts
git commit -m "feat: checklists operacionais padrão por tipo de evento"
```

---

## Task 2: Listener lead.closed Cria Evento e Checklists

**Files:**
- Create: `lib/production/on-lead-closed.ts`
- Modify: `instrumentation.ts` (já criado na Fase 2 com stub)

- [ ] **Step 1: Criar `lib/production/on-lead-closed.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'
import { getDefaultChecklist } from './default-checklists'

export function registerProductionLeadClosedListener() {
  eventBus.on('lead.closed', async ({ lead_id, band_id }) => {
    try {
      const lead = await prisma.lead.findUnique({ where: { id: lead_id } })
      if (!lead) return

      // Verificar se já existe evento para este lead
      const existingEvent = await prisma.event.findUnique({ where: { lead_id } })
      if (existingEvent) return

      if (!lead.event_date) {
        console.warn(`Lead ${lead_id} fechado sem data de evento — evento não criado.`)
        return
      }

      // Criar evento com dados herdados do lead
      const event = await prisma.event.create({
        data: {
          band_id,
          lead_id,
          client_name:     lead.client_name,
          event_type:      lead.event_type,
          event_date:      lead.event_date,
          venue_name:      lead.venue_name ?? 'A definir',
          venue_address:   lead.city ?? undefined,
          venue_has_sound: lead.venue_has_sound,
          venue_has_light: lead.venue_has_light,
          value:           lead.budget ?? 0,
          status:          'contracted',
          notes:           lead.observations ?? undefined,
        },
      })

      // Criar checklist padrão baseado no tipo de evento
      const defaultItems = getDefaultChecklist(lead.event_type)
      await prisma.checklist.create({
        data: {
          event_id: event.id,
          title: 'Checklist Operacional',
          items: {
            create: defaultItems.map(item => ({
              description: item.description,
              done: false,
            })),
          },
        },
      })

      // Disparar evento para módulo de Agenda (Fase 4)
      eventBus.emit('event.created', { event_id: event.id, band_id })

      console.log(`Evento ${event.id} criado para lead ${lead_id}`)
    } catch (err) {
      console.error('Erro ao criar evento após lead.closed:', err)
    }
  })
}
```

- [ ] **Step 2: Verificar que `instrumentation.ts` já importa este listener**

O arquivo `instrumentation.ts` criado na Fase 2 já tem:
```typescript
const { registerProductionLeadClosedListener } = await import('@/lib/production/on-lead-closed')
registerProductionLeadClosedListener()
```

Se não tiver, adicionar essa linha.

- [ ] **Step 3: Commit**

```bash
git add lib/production/on-lead-closed.ts instrumentation.ts
git commit -m "feat: listener lead.closed cria Event + checklist operacional + emite event.created"
```

---

## Task 3: Validação e API de Eventos

**Files:**
- Create: `lib/validations/event.ts`
- Create: `app/api/events/route.ts`
- Create: `app/api/events/[id]/route.ts`

- [ ] **Step 1: Criar `lib/validations/event.ts`**

```typescript
import { z } from 'zod'

export const eventUpdateSchema = z.object({
  event_time:          z.string().optional(),
  venue_address:       z.string().optional(),
  value:               z.number().positive().optional(),
  status:              z.enum(['contracted', 'active', 'done']).optional(),
  technical_visit_date: z.string().datetime().optional().nullable(),
  notes:               z.string().optional(),
})

export type EventUpdateInput = z.infer<typeof eventUpdateSchema>
```

- [ ] **Step 2: Criar `app/api/events/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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
  const status = searchParams.get('status')

  const events = await prisma.event.findMany({
    where: {
      band_id: sessionUser.band_id,
      ...(status ? { status: status as any } : { status: { in: ['contracted', 'active'] } }),
    },
    include: {
      checklists: {
        include: { items: { select: { id: true, done: true } } },
      },
      event_musicians: { select: { id: true, status: true } },
    },
    orderBy: { event_date: 'asc' },
  })

  return NextResponse.json({ data: events })
}
```

- [ ] **Step 3: Criar `app/api/events/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { eventUpdateSchema } from '@/lib/validations/event'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
    include: {
      lead: { select: { id: true, phone: true } },
      checklists: { include: { items: { orderBy: { id: 'asc' } } } },
      event_musicians: {
        include: { user: { select: { id: true, name: true, avatar_url: true } } },
        orderBy: { id: 'asc' },
      },
      documents: { orderBy: { created_at: 'desc' } },
    },
  })

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: event })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'producer'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = eventUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const existing = await prisma.event.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.event.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      technical_visit_date: parsed.data.technical_visit_date
        ? new Date(parsed.data.technical_visit_date)
        : parsed.data.technical_visit_date === null
        ? null
        : undefined,
    },
  })

  return NextResponse.json({ data: updated })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/validations/event.ts app/api/events/
git commit -m "feat: API de eventos com GET lista e detalhe + PATCH para atualizar"
```

---

## Task 4: API de Checklists e Músicos do Evento

**Files:**
- Create: `app/api/checklists/[id]/items/route.ts`
- Create: `app/api/event-musicians/route.ts`

- [ ] **Step 1: Criar `app/api/checklists/[id]/items/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ itemId: z.string().cuid(), done: z.boolean() })

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'producer'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Verificar que o checklist pertence à banda
  const checklist = await prisma.checklist.findUnique({
    where: { id: params.id },
    include: { event: { select: { band_id: true } } },
  })

  if (!checklist || checklist.event.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.checklistItem.update({
    where: { id: parsed.data.itemId, checklist_id: params.id },
    data: { done: parsed.data.done },
  })

  return NextResponse.json({ data: updated })
}
```

- [ ] **Step 2: Criar `app/api/event-musicians/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addMusicianSchema = z.object({
  event_id:   z.string().cuid(),
  user_id:    z.string().cuid(),
  instrument: z.string().optional(),
})

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'producer'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = addMusicianSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Verificar que o evento pertence à banda
  const event = await prisma.event.findUnique({
    where: { id: parsed.data.event_id, band_id: sessionUser.band_id },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Verificar que o usuário pertence à banda
  const musician = await prisma.user.findUnique({
    where: { id: parsed.data.user_id, band_id: sessionUser.band_id },
  })
  if (!musician) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const eventMusician = await prisma.eventMusician.upsert({
    where: {
      event_id_user_id: { event_id: parsed.data.event_id, user_id: parsed.data.user_id },
    },
    create: {
      event_id:   parsed.data.event_id,
      user_id:    parsed.data.user_id,
      instrument: parsed.data.instrument,
      status:     'pending',
    },
    update: { instrument: parsed.data.instrument },
    include: { user: { select: { id: true, name: true, avatar_url: true } } },
  })

  return NextResponse.json({ data: eventMusician }, { status: 201 })
}

export async function DELETE(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'producer'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const em = await prisma.eventMusician.findUnique({
    where: { id },
    include: { event: { select: { band_id: true } } },
  })

  if (!em || em.event.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.eventMusician.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/checklists/ app/api/event-musicians/
git commit -m "feat: API de itens de checklist (toggle done) e músicos do evento"
```

---

## Task 5: Componentes do Módulo de Produção

**Files:**
- Create: `components/producao/ChecklistPanel.tsx`
- Create: `components/producao/ChecklistItemRow.tsx`
- Create: `components/producao/TeamPanel.tsx`
- Create: `components/producao/EventList.tsx`

- [ ] **Step 1: Criar `components/producao/ChecklistItemRow.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ChecklistItem } from '@/types'

interface ChecklistItemRowProps {
  checklistId: string
  item: ChecklistItem
}

export function ChecklistItemRow({ checklistId, item }: ChecklistItemRowProps) {
  const [done, setDone] = useState(item.done)
  const [updating, setUpdating] = useState(false)

  async function toggle() {
    setUpdating(true)
    const newDone = !done
    setDone(newDone)

    await fetch(`/api/checklists/${checklistId}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, done: newDone }),
    })

    setUpdating(false)
  }

  return (
    <label
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-gray-50 transition-colors',
        updating && 'opacity-50'
      )}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        disabled={updating}
        className="h-4 w-4 rounded"
      />
      <span className={cn('text-sm', done && 'line-through text-gray-400')}>
        {item.description}
      </span>
    </label>
  )
}
```

- [ ] **Step 2: Criar `components/producao/ChecklistPanel.tsx`**

```typescript
import { ChecklistItemRow } from './ChecklistItemRow'
import type { Checklist, ChecklistItem } from '@/types'

type ChecklistWithItems = Checklist & { items: ChecklistItem[] }

interface ChecklistPanelProps {
  checklists: ChecklistWithItems[]
}

export function ChecklistPanel({ checklists }: ChecklistPanelProps) {
  if (checklists.length === 0) {
    return <p className="text-gray-400 text-sm">Nenhum checklist criado.</p>
  }

  return (
    <div className="space-y-6">
      {checklists.map(checklist => {
        const doneCount = checklist.items.filter(i => i.done).length
        const total = checklist.items.length
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

        return (
          <div key={checklist.id} className="border rounded-lg">
            <div className="flex items-center justify-between p-3 border-b bg-gray-50">
              <span className="font-medium text-sm">{checklist.title}</span>
              <span className="text-xs text-gray-500">{doneCount}/{total} ({pct}%)</span>
            </div>
            <div className="p-1">
              {checklist.items.map(item => (
                <ChecklistItemRow key={item.id} checklistId={checklist.id} item={item} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Criar `components/producao/TeamPanel.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import type { EventMusician, User } from '@/types'

const statusConfig = {
  pending:   { label: 'Pendente', variant: 'outline' as const },
  confirmed: { label: 'Confirmado', variant: 'default' as const },
  declined:  { label: 'Recusou', variant: 'destructive' as const },
}

type EventMusicianWithUser = EventMusician & {
  user: Pick<User, 'id' | 'name' | 'avatar_url'>
}

interface TeamPanelProps {
  eventId: string
  musicians: EventMusicianWithUser[]
  bandMembers: Pick<User, 'id' | 'name'>[]
}

export function TeamPanel({ eventId, musicians: initialMusicians, bandMembers }: TeamPanelProps) {
  const router = useRouter()
  const [musicians, setMusicians] = useState(initialMusicians)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [adding, setAdding] = useState(false)

  const alreadyAdded = new Set(musicians.map(m => m.user_id))
  const available = bandMembers.filter(m => !alreadyAdded.has(m.id))

  async function addMusician() {
    if (!selectedUserId) return
    setAdding(true)

    const res = await fetch('/api/event-musicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, user_id: selectedUserId }),
    })

    if (res.ok) {
      router.refresh()
      setSelectedUserId('')
    }
    setAdding(false)
  }

  async function removeMusician(id: string) {
    await fetch(`/api/event-musicians?id=${id}`, { method: 'DELETE' })
    setMusicians(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {musicians.length === 0 && (
          <p className="text-gray-400 text-sm">Nenhum músico escalado ainda.</p>
        )}
        {musicians.map(em => {
          const { label, variant } = statusConfig[em.status] ?? statusConfig.pending
          return (
            <div key={em.id} className="flex items-center gap-3 p-2 border rounded-lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{em.user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{em.user.name}</p>
                {em.instrument && <p className="text-xs text-gray-400">{em.instrument}</p>}
              </div>
              <Badge variant={variant}>{label}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeMusician(em.id)}
              >
                <X size={14} />
              </Button>
            </div>
          )
        })}
      </div>

      {available.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Adicionar membro" />
            </SelectTrigger>
            <SelectContent>
              {available.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addMusician} disabled={!selectedUserId || adding}>
            Adicionar
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Criar `components/producao/EventList.tsx`**

```typescript
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import type { Event, Checklist, ChecklistItem, EventMusician } from '@/types'

type EventWithProgress = Event & {
  checklists: (Checklist & { items: Pick<ChecklistItem, 'id' | 'done'>[] })[]
  event_musicians: Pick<EventMusician, 'id' | 'status'>[]
}

const statusLabels: Record<string, string> = {
  contracted: 'Contratado',
  active:     'Em andamento',
  done:       'Concluído',
}

interface EventListProps {
  events: EventWithProgress[]
  bandSlug: string
}

export function EventList({ events, bandSlug }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Nenhum evento em produção.</p>
        <p className="text-sm mt-1">Feche um lead no módulo Comercial para criar um evento.</p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {events.map(event => {
        const allItems = event.checklists.flatMap(c => c.items)
        const doneItems = allItems.filter(i => i.done).length
        const pct = allItems.length > 0 ? Math.round((doneItems / allItems.length) * 100) : 0
        const confirmedMusicians = event.event_musicians.filter(m => m.status === 'confirmed').length

        return (
          <Link
            key={event.id}
            href={`/${bandSlug}/producao/${event.id}`}
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div>
              <p className="font-medium">{event.client_name}</p>
              <p className="text-sm text-gray-500">
                {format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
                {event.venue_name && ` — ${event.venue_name}`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Checklist: {pct}% · Músicos confirmados: {confirmedMusicians}/{event.event_musicians.length}
              </p>
            </div>
            <Badge variant={event.status === 'done' ? 'secondary' : 'default'}>
              {statusLabels[event.status]}
            </Badge>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/producao/
git commit -m "feat: componentes do módulo de produção (checklist, equipe, lista de eventos)"
```

---

## Task 6: Páginas do Módulo de Produção

**Files:**
- Create: `app/(dashboard)/[bandSlug]/producao/page.tsx`
- Create: `app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx`

- [ ] **Step 1: Criar `app/(dashboard)/[bandSlug]/producao/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EventList } from '@/components/producao/EventList'

export default async function ProducaoPage({ params }: { params: { bandSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const events = await prisma.event.findMany({
    where: {
      band_id: dbUser.band_id,
      status: { in: ['contracted', 'active'] },
    },
    include: {
      checklists: { include: { items: { select: { id: true, done: true } } } },
      event_musicians: { select: { id: true, status: true } },
    },
    orderBy: { event_date: 'asc' },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Produção</h1>
        <p className="text-gray-500 text-sm">Eventos ativos e em preparação</p>
      </div>
      <div className="border rounded-lg bg-white">
        <EventList events={events} bandSlug={params.bandSlug} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ChecklistPanel } from '@/components/producao/ChecklistPanel'
import { TeamPanel } from '@/components/producao/TeamPanel'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

export default async function EventDetailPage({
  params,
}: { params: { bandSlug: string; eventoId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const event = await prisma.event.findUnique({
    where: { id: params.eventoId, band_id: dbUser.band_id },
    include: {
      checklists: { include: { items: { orderBy: { id: 'asc' } } } },
      event_musicians: {
        include: { user: { select: { id: true, name: true, avatar_url: true } } },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!event) notFound()

  const bandMembers = await prisma.user.findMany({
    where: { band_id: dbUser.band_id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.client_name}</h1>
          <p className="text-gray-500">
            {format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
            {event.event_time && ` às ${event.event_time}`}
          </p>
        </div>
        <Badge>{eventTypeLabels[event.event_type] ?? event.event_type}</Badge>
      </div>

      {/* Informações do evento */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">Local:</span> {event.venue_name}
        </div>
        {event.venue_address && (
          <div><span className="font-medium">Endereço:</span> {event.venue_address}</div>
        )}
        <div>
          <span className="font-medium">Som:</span>{' '}
          {event.venue_has_sound ? '✅ Incluso' : '❌ Providenciar'}
        </div>
        <div>
          <span className="font-medium">Luz:</span>{' '}
          {event.venue_has_light ? '✅ Incluso' : '❌ Providenciar'}
        </div>
        <div>
          <span className="font-medium">Valor:</span>{' '}
          R$ {event.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div>
          <span className="font-medium">Visita técnica:</span>{' '}
          {event.technical_visit_date
            ? format(new Date(event.technical_visit_date), 'dd/MM/yyyy', { locale: ptBR })
            : 'Aguardando data do contratante'}
        </div>
      </div>

      {event.notes && (
        <div>
          <h3 className="font-semibold mb-1">Observações</h3>
          <p className="text-sm text-gray-600">{event.notes}</p>
        </div>
      )}

      {/* Checklists */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Checklists Operacionais</h2>
        <ChecklistPanel checklists={event.checklists} />
      </div>

      {/* Equipe */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Equipe Escalada</h2>
        <TeamPanel
          eventId={event.id}
          musicians={event.event_musicians}
          bandMembers={bandMembers}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: páginas do módulo de produção — lista e detalhe com checklists e equipe"
```

---

## Task 7: Verificação Final do Módulo de Produção

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

1. Fechar um lead no Kanban (módulo Comercial)
2. Verificar que o evento aparece na lista de Produção
3. Abrir o evento e verificar checklist com itens padrão
4. Marcar alguns itens como concluídos e verificar que a porcentagem atualiza
5. Adicionar um músico à equipe do evento

- [ ] **Step 4: Commit final da fase**

```bash
git add .
git commit -m "feat: Fase 3 completa — Módulo de Produção com eventos, checklists e equipe"
```

---

## Checklist da Fase 3

- [ ] Checklists padrão por tipo de evento testados (4 testes)
- [ ] Listener `lead.closed` cria `Event` com dados do `Lead`
- [ ] Listener cria checklist operacional com itens padrão
- [ ] Evento `event.created` emitido após criação
- [ ] API `/api/events` GET funcionando
- [ ] API `/api/events/[id]` GET e PATCH funcionando
- [ ] API de toggle de itens do checklist funcionando
- [ ] API de músicos do evento (add/remove) funcionando
- [ ] Lista de eventos na página de Produção
- [ ] Página de detalhe com checklists interativos e painel de equipe
- [ ] Todos os testes passando

**Próximo:** [Fase 4 — Módulo de Agenda](./2026-05-25-fase-4-agenda.md)
