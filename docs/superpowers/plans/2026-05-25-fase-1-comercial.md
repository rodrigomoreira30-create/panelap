# PanelAp — Fase 1: Módulo Comercial

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o CRM completo com pipeline Kanban, gestão de leads, histórico de mensagens WhatsApp e sidebar de navegação do dashboard.

**Architecture:** API Routes para CRUD de leads. Kanban Board com drag-and-drop client-side. Mensagens armazenadas no banco e sincronizadas via webhook WhatsApp. Quando lead muda para `closed`, dispara `lead.closed` no event bus — os módulos de Contratos e Produção escutam esse evento.

**Tech Stack:** Next.js 14 App Router, Prisma, Zod (validação), `@dnd-kit/core` (drag-and-drop), Vitest.

**Pré-requisito:** Fase 0 completa e funcionando.

---

## Mapa de Arquivos

```
app/
├── (dashboard)/[bandSlug]/
│   ├── layout.tsx               # Atualizar: adicionar sidebar
│   ├── comercial/
│   │   ├── page.tsx             # Pipeline Kanban
│   │   └── [leadId]/
│   │       └── page.tsx         # Detalhe do lead + mensagens
│   └── page.tsx                 # Redireciona para /comercial
├── api/
│   ├── leads/
│   │   ├── route.ts             # GET /api/leads, POST /api/leads
│   │   └── [id]/
│   │       └── route.ts         # GET, PATCH, DELETE /api/leads/:id
│   └── webhooks/
│       └── whatsapp/
│           └── route.ts         # POST — receber mensagens do WhatsApp
components/
├── shared/
│   └── Sidebar.tsx              # Navegação lateral do dashboard
└── comercial/
    ├── KanbanBoard.tsx          # Board com colunas por status
    ├── KanbanColumn.tsx         # Coluna individual do Kanban
    ├── LeadCard.tsx             # Card arrastável do lead
    ├── LeadForm.tsx             # Formulário criar/editar lead
    └── MessageThread.tsx        # Lista de mensagens de um lead
lib/
└── whatsapp/
    └── client.ts                # Envio de mensagens WhatsApp
__tests__/
├── api/
│   └── leads.test.ts
└── lib/
    └── whatsapp.test.ts
```

---

## Task 1: Instalar Dependência de Drag-and-Drop

- [ ] **Step 1: Instalar `@dnd-kit`**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adicionar @dnd-kit para drag-and-drop do Kanban"
```

---

## Task 2: API de Leads — CRUD

**Files:**
- Create: `app/api/leads/route.ts`
- Create: `app/api/leads/[id]/route.ts`
- Create: `__tests__/api/leads.test.ts`

- [ ] **Step 1: Escrever os testes da API de leads**

```typescript
// __tests__/api/leads.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lead: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// Mock do Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'supabase-user-1' } },
      }),
    },
  }),
}))

vi.mock('@/lib/prisma', async () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          band_id: 'band-1',
          role: 'admin',
          name: 'Admin',
          email: 'admin@test.com',
        }),
      },
      lead: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'lead-1', client_name: 'João' }),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  }
})

// Testes de validação de payload
import { leadCreateSchema, leadUpdateSchema } from '@/lib/validations/lead'

describe('leadCreateSchema', () => {
  it('valida payload mínimo correto', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João Silva',
      phone: '11999999999',
      event_type: 'wedding',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita payload sem client_name', () => {
    const result = leadCreateSchema.safeParse({
      phone: '11999999999',
      event_type: 'wedding',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita event_type inválido', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João',
      phone: '11999999999',
      event_type: 'invalid_type',
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
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npx vitest run __tests__/api/leads.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/validations/lead'`

- [ ] **Step 3: Criar `lib/validations/lead.ts`**

```typescript
import { z } from 'zod'

const eventTypes = ['wedding', 'party', 'show', 'corporate', 'other'] as const
const leadStatuses = ['new_lead', 'attending', 'proposal_sent', 'negotiation', 'closed', 'lost'] as const

export const leadCreateSchema = z.object({
  client_name:     z.string().min(2, 'Nome obrigatório'),
  phone:           z.string().min(10, 'Telefone inválido'),
  event_type:      z.enum(eventTypes),
  event_date:      z.string().datetime().optional(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  venue_has_sound: z.boolean().optional().default(false),
  venue_has_light: z.boolean().optional().default(false),
  budget:          z.number().positive().optional(),
  assigned_to:     z.string().cuid().optional(),
  observations:    z.string().optional(),
})

export const leadUpdateSchema = z.object({
  client_name:     z.string().min(2).optional(),
  phone:           z.string().min(10).optional(),
  event_type:      z.enum(eventTypes).optional(),
  event_date:      z.string().datetime().optional().nullable(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  venue_has_sound: z.boolean().optional(),
  venue_has_light: z.boolean().optional(),
  budget:          z.number().positive().optional().nullable(),
  assigned_to:     z.string().cuid().optional().nullable(),
  status:          z.enum(leadStatuses).optional(),
  observations:    z.string().optional(),
})

export type LeadCreateInput = z.infer<typeof leadCreateSchema>
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>
```

- [ ] **Step 4: Rodar para confirmar que passa**

```bash
npx vitest run __tests__/api/leads.test.ts
```

Esperado: PASS (5 testes)

- [ ] **Step 5: Criar `app/api/leads/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadCreateSchema } from '@/lib/validations/lead'
import { eventBus } from '@/lib/events/internal-bus'

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

  const leads = await prisma.lead.findMany({
    where: {
      band_id: sessionUser.band_id,
      ...(status ? { status: status as any } : {}),
    },
    include: { assignee: { select: { id: true, name: true, avatar_url: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ data: leads })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = leadCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const lead = await prisma.lead.create({
    data: {
      ...parsed.data,
      band_id: sessionUser.band_id,
      event_date: parsed.data.event_date ? new Date(parsed.data.event_date) : undefined,
    },
  })

  return NextResponse.json({ data: lead }, { status: 201 })
}
```

- [ ] **Step 6: Criar `app/api/leads/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { leadUpdateSchema } from '@/lib/validations/lead'
import { eventBus } from '@/lib/events/internal-bus'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = await prisma.lead.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
    include: {
      messages: { orderBy: { sent_at: 'asc' } },
      assignee: { select: { id: true, name: true, avatar_url: true } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: lead })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = leadUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const existing = await prisma.lead.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.lead.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      event_date: parsed.data.event_date ? new Date(parsed.data.event_date) : undefined,
    },
  })

  // Disparar evento quando lead é fechado
  if (parsed.data.status === 'closed' && existing.status !== 'closed') {
    eventBus.emit('lead.closed', { lead_id: updated.id, band_id: updated.band_id })
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await prisma.lead.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.lead.delete({ where: { id: params.id } })
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 7: Commit**

```bash
git add app/api/leads/ lib/validations/ __tests__/api/leads.test.ts
git commit -m "feat: API CRUD de leads com validação Zod e disparo de lead.closed"
```

---

## Task 3: Sidebar de Navegação

**Files:**
- Create: `components/shared/Sidebar.tsx`
- Modify: `app/(dashboard)/[bandSlug]/layout.tsx`

- [ ] **Step 1: Criar `components/shared/Sidebar.tsx`**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, Cog, Calendar, FolderOpen, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBand } from './BandProvider'

const navItems = [
  { href: '',           label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/comercial', label: 'Comercial',   icon: Users },
  { href: '/contratos', label: 'Contratos',   icon: FileText },
  { href: '/producao',  label: 'Produção',    icon: Cog },
  { href: '/agenda',    label: 'Agenda',      icon: Calendar },
  { href: '/documentos',label: 'Documentos',  icon: FolderOpen },
]

export function Sidebar() {
  const { band } = useBand()
  const pathname = usePathname()
  const base = `/${band.slug}`

  return (
    <aside className="w-56 bg-white border-r flex flex-col">
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg">{band.name}</h1>
        <p className="text-xs text-gray-400">PanelAp</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullPath = `${base}${href}`
          const isActive = href === ''
            ? pathname === base
            : pathname.startsWith(fullPath)
          return (
            <Link
              key={href}
              href={fullPath}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t">
        <Link
          href={`${base}/configuracoes`}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <Settings size={14} /> Configurações
        </Link>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Atualizar `app/(dashboard)/[bandSlug]/layout.tsx`**

Substituir o comentário `{/* Sidebar será adicionada na Fase 1 */}` pelo componente real:

```typescript
import { Sidebar } from '@/components/shared/Sidebar'

// No JSX, substituir:
<div className="flex h-screen bg-gray-50">
  <Sidebar />
  <main className="flex-1 overflow-auto p-6">{children}</main>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add components/shared/Sidebar.tsx app/
git commit -m "feat: sidebar de navegação do dashboard"
```

---

## Task 4: Componentes do Kanban

**Files:**
- Create: `components/comercial/LeadCard.tsx`
- Create: `components/comercial/KanbanColumn.tsx`
- Create: `components/comercial/KanbanBoard.tsx`
- Create: `components/comercial/LeadForm.tsx`

- [ ] **Step 1: Criar `components/comercial/LeadCard.tsx`**

```typescript
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Lead, User } from '@/types'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

interface LeadCardProps {
  lead: Lead & { assignee: Pick<User, 'id' | 'name' | 'avatar_url'> | null }
  onClick: () => void
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <p className="font-medium text-sm leading-tight">{lead.client_name}</p>
            <Badge variant="secondary" className="text-xs shrink-0 ml-1">
              {eventTypeLabels[lead.event_type] ?? lead.event_type}
            </Badge>
          </div>
          {lead.event_date && (
            <p className="text-xs text-gray-500">
              {format(new Date(lead.event_date), "dd 'de' MMM yyyy", { locale: ptBR })}
            </p>
          )}
          {lead.city && (
            <p className="text-xs text-gray-400">{lead.city}</p>
          )}
          {lead.budget && (
            <p className="text-xs font-medium text-green-600">
              R$ {lead.budget.toLocaleString('pt-BR')}
            </p>
          )}
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
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Criar `components/comercial/KanbanColumn.tsx`**

```typescript
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard } from './LeadCard'
import { Badge } from '@/components/ui/badge'
import type { Lead, User } from '@/types'

const statusColors: Record<string, string> = {
  new_lead:      'bg-gray-100',
  attending:     'bg-blue-50',
  proposal_sent: 'bg-yellow-50',
  negotiation:   'bg-orange-50',
  closed:        'bg-green-50',
  lost:          'bg-red-50',
}

const statusLabels: Record<string, string> = {
  new_lead:      'Novo Lead',
  attending:     'Em Atendimento',
  proposal_sent: 'Proposta Enviada',
  negotiation:   'Negociação',
  closed:        'Fechado',
  lost:          'Perdido',
}

type LeadWithAssignee = Lead & {
  assignee: Pick<User, 'id' | 'name' | 'avatar_url'> | null
}

interface KanbanColumnProps {
  status: string
  leads: LeadWithAssignee[]
  onLeadClick: (lead: LeadWithAssignee) => void
}

export function KanbanColumn({ status, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <div className={`flex flex-col rounded-lg p-3 min-h-[400px] w-56 shrink-0 ${statusColors[status] ?? 'bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{statusLabels[status]}</span>
        <Badge variant="outline" className="text-xs">{leads.length}</Badge>
      </div>
      <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2 flex-1">
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
```

- [ ] **Step 3: Criar `components/comercial/KanbanBoard.tsx`**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import type { Lead, User } from '@/types'

const PIPELINE_STAGES = ['new_lead', 'attending', 'proposal_sent', 'negotiation', 'closed', 'lost']

type LeadWithAssignee = Lead & {
  assignee: Pick<User, 'id' | 'name' | 'avatar_url'> | null
}

interface KanbanBoardProps {
  initialLeads: LeadWithAssignee[]
  bandSlug: string
}

export function KanbanBoard({ initialLeads, bandSlug }: KanbanBoardProps) {
  const router = useRouter()
  const [leads, setLeads] = useState<LeadWithAssignee[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const getLeadsByStatus = (status: string) =>
    leads.filter(l => l.status === status)

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const leadId = active.id as string
    const newStatus = over.id as string

    if (!PIPELINE_STAGES.includes(newStatus)) return

    // Atualização otimista
    setLeads(prev =>
      prev.map(l => l.id === leadId ? { ...l, status: newStatus as any } : l)
    )

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar status')
    } catch {
      // Reverter em caso de erro
      setLeads(initialLeads)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => (
          <KanbanColumn
            key={stage}
            status={stage}
            leads={getLeadsByStatus(stage)}
            onLeadClick={lead => router.push(`/${bandSlug}/comercial/${lead.id}`)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && (
          <LeadCard lead={activeLead} onClick={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 4: Criar `components/comercial/LeadForm.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface LeadFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function LeadForm({ onSuccess, onCancel }: LeadFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    client_name: '', phone: '', event_type: '',
    city: '', venue_name: '', budget: '',
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

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        budget: form.budget ? parseFloat(form.budget) : undefined,
      }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      setError(typeof error === 'string' ? error : 'Erro ao criar lead')
      setLoading(false)
      return
    }

    onSuccess()
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

- [ ] **Step 5: Commit**

```bash
git add components/comercial/
git commit -m "feat: componentes Kanban (Board, Column, LeadCard) e LeadForm"
```

---

## Task 5: Páginas do Módulo Comercial

**Files:**
- Create: `app/(dashboard)/[bandSlug]/comercial/page.tsx`
- Create: `app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx`
- Create: `components/comercial/MessageThread.tsx`

- [ ] **Step 1: Criar `app/(dashboard)/[bandSlug]/comercial/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/comercial/KanbanBoard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LeadForm } from '@/components/comercial/LeadForm'
import { Plus } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function ComercialPage({ params }: { params: { bandSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const leads = await prisma.lead.findMany({
    where: { band_id: dbUser.band_id },
    include: { assignee: { select: { id: true, name: true, avatar_url: true } } },
    orderBy: { created_at: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Comercial</h1>
          <p className="text-gray-500 text-sm">Pipeline de leads e oportunidades</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus size={16} className="mr-2" /> Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar novo lead</DialogTitle>
            </DialogHeader>
            <LeadFormWrapper />
          </DialogContent>
        </Dialog>
      </div>
      <KanbanBoard initialLeads={leads} bandSlug={params.bandSlug} />
    </div>
  )
}

// Wrapper client para fechar dialog ao criar lead
'use client'
function LeadFormWrapper() {
  const router = require('next/navigation').useRouter()
  return (
    <LeadForm
      onSuccess={() => router.refresh()}
      onCancel={() => {}}
    />
  )
}
```

> **Nota:** Extrair `LeadFormWrapper` para um arquivo `components/comercial/LeadFormWrapper.tsx` separado para evitar mistura de `'use client'` no arquivo de Server Component.

- [ ] **Step 2: Criar `components/comercial/LeadFormWrapper.tsx`**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { LeadForm } from './LeadForm'

export function LeadFormWrapper() {
  const router = useRouter()
  return (
    <LeadForm
      onSuccess={() => router.refresh()}
      onCancel={() => {}}
    />
  )
}
```

- [ ] **Step 3: Atualizar `app/(dashboard)/[bandSlug]/comercial/page.tsx` para usar o wrapper**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/comercial/KanbanBoard'
import { LeadFormWrapper } from '@/components/comercial/LeadFormWrapper'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

export default async function ComercialPage({ params }: { params: { bandSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const leads = await prisma.lead.findMany({
    where: { band_id: dbUser.band_id },
    include: { assignee: { select: { id: true, name: true, avatar_url: true } } },
    orderBy: { created_at: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Comercial</h1>
          <p className="text-gray-500 text-sm">Pipeline de leads e oportunidades</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Novo Lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Criar novo lead</DialogTitle></DialogHeader>
            <LeadFormWrapper />
          </DialogContent>
        </Dialog>
      </div>
      <KanbanBoard initialLeads={leads} bandSlug={params.bandSlug} />
    </div>
  )
}
```

- [ ] **Step 4: Criar `components/comercial/MessageThread.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface MessageThreadProps {
  leadId: string
  messages: Message[]
}

export function MessageThread({ leadId, messages: initialMessages }: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function sendMessage() {
    if (!text.trim()) return
    setSending(true)

    const res = await fetch(`/api/leads/${leadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })

    if (res.ok) {
      const { data } = await res.json()
      setMessages(prev => [...prev, data])
      setText('')
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">Nenhuma mensagem ainda</p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.direction === 'out' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-xs px-3 py-2 rounded-lg text-sm',
                msg.direction === 'out'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <p>{msg.content}</p>
              <p className={cn(
                'text-xs mt-1',
                msg.direction === 'out' ? 'text-green-100' : 'text-gray-400'
              )}>
                {format(new Date(msg.sent_at), 'HH:mm', { locale: ptBR })}
                {msg.sent_by === 'agent' && ' · IA'}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-3 flex gap-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Digite uma mensagem..."
          className="resize-none h-16"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
        />
        <Button onClick={sendMessage} disabled={sending || !text.trim()} className="shrink-0">
          Enviar
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Criar `app/api/leads/[id]/messages/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ content: z.string().min(1) })

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 422 })

  const lead = await prisma.lead.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const message = await prisma.message.create({
    data: {
      lead_id: params.id,
      direction: 'out',
      content: parsed.data.content,
      sent_by: sessionUser.name,
    },
  })

  // TODO Fase 6: também enviar via WhatsApp API

  return NextResponse.json({ data: message }, { status: 201 })
}
```

- [ ] **Step 6: Criar `app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MessageThread } from '@/components/comercial/MessageThread'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const statusLabels: Record<string, string> = {
  new_lead: 'Novo Lead', attending: 'Em Atendimento',
  proposal_sent: 'Proposta Enviada', negotiation: 'Negociação',
  closed: 'Fechado', lost: 'Perdido',
}

export default async function LeadDetailPage({
  params,
}: {
  params: { bandSlug: string; leadId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId, band_id: dbUser.band_id },
    include: {
      messages: { orderBy: { sent_at: 'asc' } },
      assignee: { select: { id: true, name: true } },
    },
  })

  if (!lead) notFound()

  return (
    <div className="flex h-full gap-6">
      {/* Painel de informações */}
      <div className="w-80 shrink-0 space-y-4">
        <div>
          <h2 className="text-xl font-bold">{lead.client_name}</h2>
          <p className="text-gray-500">{lead.phone}</p>
          <Badge className="mt-1">{statusLabels[lead.status]}</Badge>
        </div>
        <div className="space-y-2 text-sm">
          {lead.event_date && (
            <div>
              <span className="font-medium">Data do evento:</span>{' '}
              {format(new Date(lead.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
            </div>
          )}
          {lead.city && (
            <div><span className="font-medium">Cidade:</span> {lead.city}</div>
          )}
          {lead.venue_name && (
            <div><span className="font-medium">Local:</span> {lead.venue_name}</div>
          )}
          {lead.budget && (
            <div>
              <span className="font-medium">Orçamento:</span>{' '}
              R$ {lead.budget.toLocaleString('pt-BR')}
            </div>
          )}
          <div>
            <span className="font-medium">Som:</span>{' '}
            {lead.venue_has_sound ? '✅ Incluso' : '❌ Não incluso'}
          </div>
          <div>
            <span className="font-medium">Luz:</span>{' '}
            {lead.venue_has_light ? '✅ Incluso' : '❌ Não incluso'}
          </div>
          {lead.assignee && (
            <div><span className="font-medium">Responsável:</span> {lead.assignee.name}</div>
          )}
          {lead.observations && (
            <div>
              <span className="font-medium">Observações:</span>
              <p className="text-gray-600 mt-1">{lead.observations}</p>
            </div>
          )}
        </div>
      </div>
      {/* Thread de mensagens */}
      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b bg-gray-50">
          <h3 className="font-medium text-sm">Histórico de Mensagens</h3>
        </div>
        <MessageThread leadId={lead.id} messages={lead.messages} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/ components/comercial/ app/api/leads/
git commit -m "feat: páginas do módulo comercial — Kanban, detalhe do lead, thread de mensagens"
```

---

## Task 6: Webhook WhatsApp (Recebimento)

**Files:**
- Create: `app/api/webhooks/whatsapp/route.ts`
- Create: `lib/whatsapp/client.ts`

- [ ] **Step 1: Criar `lib/whatsapp/client.ts`**

```typescript
interface SendMessageParams {
  to: string
  message: string
}

export async function sendWhatsAppMessage({ to, message }: SendMessageParams): Promise<void> {
  const res = await fetch(`${process.env.WHATSAPP_API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
    },
    body: JSON.stringify({ to, message }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`WhatsApp API error ${res.status}: ${body}`)
  }
}
```

- [ ] **Step 2: Criar `app/api/webhooks/whatsapp/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'
import crypto from 'crypto'

function verifySignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')
  return `sha256=${expected}` === signature
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)

  // Formato genérico — adaptar ao provider escolhido
  const phone: string = payload.from
  const content: string = payload.body ?? payload.text ?? ''

  if (!phone || !content) {
    return NextResponse.json({ ok: true }) // Ignorar mensagens sem conteúdo
  }

  // Buscar lead pelo telefone (normalizar removendo não-dígitos)
  const normalizedPhone = phone.replace(/\D/g, '')
  const lead = await prisma.lead.findFirst({
    where: { phone: { contains: normalizedPhone } },
  })

  if (lead) {
    // Salvar mensagem recebida
    await prisma.message.create({
      data: {
        lead_id: lead.id,
        direction: 'in',
        content,
        sent_by: 'client',
      },
    })

    // Notificar SDR agent (Fase 6)
    // eventBus.emit('whatsapp.message_received', { lead_id: lead.id, content })
  } else {
    // Novo lead via WhatsApp — criar automaticamente
    // O agente SDR (Fase 6) vai tratar lead.status = new_lead
    // Por ora, criar lead básico para o webhook funcionar
    const allBands = await prisma.band.findMany({ select: { id: true }, take: 1 })
    if (allBands.length > 0) {
      const newLead = await prisma.lead.create({
        data: {
          band_id: allBands[0].id,
          client_name: phone,
          phone: normalizedPhone,
          event_type: 'other',
          status: 'new_lead',
        },
      })
      await prisma.message.create({
        data: {
          lead_id: newLead.id,
          direction: 'in',
          content,
          sent_by: 'client',
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
```

> **Nota:** Na Fase 6, o Agente SDR assumirá o tratamento de novas conversas WhatsApp.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/ lib/whatsapp/
git commit -m "feat: webhook WhatsApp para receber mensagens + client de envio"
```

---

## Task 7: Verificação Final do Módulo Comercial

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

- [ ] **Step 3: Testar fluxo manualmente**

```bash
npm run dev
```

1. Acessar `http://localhost:3000/login`
2. Fazer login e verificar redirecionamento para `/{bandSlug}/comercial`
3. Criar um lead via botão "Novo Lead"
4. Verificar que aparece no Kanban na coluna "Novo Lead"
5. Arrastar para outra coluna e verificar atualização
6. Clicar no lead e verificar página de detalhe com thread de mensagens

- [ ] **Step 4: Commit final da fase**

```bash
git add .
git commit -m "feat: Fase 1 completa — Módulo Comercial com CRM, Kanban, mensagens e webhook WhatsApp"
```

---

## Checklist da Fase 1

- [ ] API `/api/leads` com GET, POST funcionando
- [ ] API `/api/leads/[id]` com GET, PATCH, DELETE funcionando
- [ ] Evento `lead.closed` disparado quando status muda para `closed`
- [ ] Validação Zod em todas as rotas
- [ ] Proteção por role (somente admin/commercial criam/editam leads)
- [ ] Sidebar de navegação funcionando
- [ ] KanbanBoard com drag-and-drop e atualização otimista
- [ ] Formulário de criação de lead
- [ ] Página de detalhe do lead com informações completas
- [ ] MessageThread com envio e recebimento de mensagens
- [ ] Webhook WhatsApp recebendo e persistindo mensagens
- [ ] Todos os testes passando

**Próximo:** [Fase 2 — Módulo de Contratos](./2026-05-25-fase-2-contratos.md)
