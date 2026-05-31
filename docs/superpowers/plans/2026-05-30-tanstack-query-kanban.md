# TanStack Query — Kanban de Leads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o controle de estado local do Kanban por TanStack Query com hidratação SSR, cache inteligente e invalidação automática em mutações.

**Architecture:** O servidor prefetch os leads via Prisma e hidrata o cache do TanStack Query via `HydrationBoundary`. No cliente, `KanbanBoard` usa `useQuery` para ler do cache e `useMutation` com atualização otimista para mover/deletar cards. `NewLeadButton` invalida o cache após criar um lead — sem nenhum `router.refresh()`.

**Tech Stack:** `@tanstack/react-query` v5, Next.js 14 App Router, TypeScript

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `lib/query-client.ts` | Criar — factory do QueryClient |
| `components/shared/QueryProvider.tsx` | Criar — wrapper Client Component |
| `app/(dashboard)/[bandSlug]/layout.tsx` | Modificar — adicionar QueryProvider |
| `app/(dashboard)/[bandSlug]/comercial/page.tsx` | Modificar — HydrationBoundary + prefetch SSR |
| `components/comercial/KanbanBoard.tsx` | Modificar — useQuery, useMutation, exportar KanbanLead |
| `components/comercial/KanbanColumn.tsx` | Modificar — importar KanbanLead |
| `components/comercial/LeadCard.tsx` | Modificar — importar KanbanLead |
| `components/comercial/NewLeadButton.tsx` | Modificar — invalidateQueries ao criar lead |

---

### Task 1: QueryClient e QueryProvider

**Files:**
- Create: `lib/query-client.ts`
- Create: `components/shared/QueryProvider.tsx`

- [ ] **Step 1: Criar `lib/query-client.ts`**

```ts
import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  })
}
```

- [ ] **Step 2: Criar `components/shared/QueryProvider.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/query-client'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/query-client.ts components/shared/QueryProvider.tsx
git commit -m "feat: adiciona QueryClient e QueryProvider para TanStack Query"
```

---

### Task 2: Adicionar QueryProvider ao layout do dashboard

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/layout.tsx`

- [ ] **Step 1: Substituir o conteúdo de `layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { BandProvider } from '@/components/shared/BandProvider'
import { Sidebar } from '@/components/shared/Sidebar'
import { QueryProvider } from '@/components/shared/QueryProvider'
import type { SessionUser } from '@/types'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()

  if (!supabaseUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: supabaseUser.id },
    include: { band: true },
  })

  if (!dbUser || !dbUser.band || dbUser.band.slug !== bandSlug) redirect('/login')

  const sessionUser: SessionUser = {
    id: dbUser.id,
    band_id: dbUser.band_id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
  }

  return (
    <BandProvider band={dbUser.band} user={sessionUser}>
      <QueryProvider>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </QueryProvider>
    </BandProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/[bandSlug]/layout.tsx"
git commit -m "feat: envolve dashboard com QueryProvider"
```

---

### Task 3: Prefetch SSR na página comercial

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/comercial/page.tsx`

O servidor cria um `QueryClient` local, faz prefetch dos leads via Prisma (transformando `Decimal` e `Date` para JSON-safe), e passa o cache desidratado para o cliente via `HydrationBoundary`. O `KanbanBoard` não recebe mais `initialLeads` como prop.

- [ ] **Step 1: Substituir o conteúdo de `comercial/page.tsx`**

```tsx
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/comercial/KanbanBoard'
import { NewLeadButton } from '@/components/comercial/NewLeadButton'

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
    select: { pipeline_stages: true },
  })

  const pipelineStages = (band?.pipeline_stages as { key: string; label: string }[] | null) ?? null

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Comercial</h1>
            <p className="text-gray-500 text-sm">Pipeline de leads e oportunidades</p>
          </div>
          <NewLeadButton />
        </div>
        <KanbanBoard
          bandSlug={bandSlug}
          pipelineStages={pipelineStages}
        />
      </div>
    </HydrationBoundary>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/[bandSlug]/comercial/page.tsx"
git commit -m "feat: prefetch SSR de leads com HydrationBoundary"
```

---

### Task 4: Refatorar KanbanBoard com useQuery e useMutation

**Files:**
- Modify: `components/comercial/KanbanBoard.tsx`

Remove a prop `initialLeads` e o `useState` de leads. Passa a usar `useQuery` para ler do cache e `useMutation` com atualização otimista para mover e deletar cards. Exporta o tipo `KanbanLead` para ser reaproveitado por `KanbanColumn` e `LeadCard`.

- [ ] **Step 1: Substituir o conteúdo de `KanbanBoard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'

const DEFAULT_STAGES = [
  { key: 'new_lead',       label: 'Novo Lead' },
  { key: 'attending',      label: 'Em Atendimento' },
  { key: 'proposal_sent',  label: 'Proposta Enviada' },
  { key: 'negotiation',    label: 'Negociação' },
  { key: 'closed',         label: 'Fechado' },
  { key: 'lost',           label: 'Perdido' },
]

type Stage = { key: string; label: string }

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
  assigned_to: string | null
  observations: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; name: string; avatar_url: string | null } | null
}

interface KanbanBoardProps {
  bandSlug: string
  pipelineStages: Stage[] | null
}

async function fetchLeads(): Promise<KanbanLead[]> {
  const res = await fetch('/api/leads')
  if (!res.ok) throw new Error('Falha ao carregar leads')
  const json = await res.json()
  return json.data.map((l: any) => ({
    ...l,
    budget: l.budget ? parseFloat(l.budget) : null,
  }))
}

export function KanbanBoard({ bandSlug, pipelineStages }: KanbanBoardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)

  const stages = pipelineStages ?? DEFAULT_STAGES
  const stageKeys = stages.map(s => s.key)
  const queryKey = ['leads', bandSlug]

  const { data: leads = [], isError, refetch } = useQuery({
    queryKey,
    queryFn: fetchLeads,
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const moveMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar status')
    },
    onMutate: async ({ leadId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KanbanLead[]>(queryKey)
      queryClient.setQueryData<KanbanLead[]>(queryKey, old =>
        (old ?? []).map(l => l.id === leadId ? { ...l, status: newStatus } : l)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (leadId: string) => {
      await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
    },
    onMutate: async (leadId) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KanbanLead[]>(queryKey)
      queryClient.setQueryData<KanbanLead[]>(queryKey, old =>
        (old ?? []).filter(l => l.id !== leadId)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const getLeadsByStatus = (status: string) => leads.filter(l => l.status === status)
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const leadId = active.id as string
    const newStatus = over.id as string
    if (!stageKeys.includes(newStatus)) return
    moveMutation.mutate({ leadId, newStatus })
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <p>Não foi possível carregar os leads.</p>
        <button onClick={() => refetch()} className="text-sm underline hover:text-gray-700">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => (
          <KanbanColumn
            key={stage.key}
            status={stage.key}
            label={stage.label}
            leads={getLeadsByStatus(stage.key)}
            onLeadClick={lead => router.push(`/${bandSlug}/comercial/${lead.id}`)}
            onLeadDelete={id => deleteMutation.mutate(id)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} onClick={() => {}} />}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/comercial/KanbanBoard.tsx
git commit -m "feat: refatora KanbanBoard com useQuery e useMutation otimista"
```

---

### Task 5: Atualizar tipos em KanbanColumn e LeadCard

**Files:**
- Modify: `components/comercial/KanbanColumn.tsx`
- Modify: `components/comercial/LeadCard.tsx`

Ambos os componentes usavam um tipo local `LeadWithAssignee` baseado no tipo Prisma (com datas como `Date`). Agora importam `KanbanLead` do `KanbanBoard`, que usa strings para datas — compatível com o que vem da API e do prefetch SSR.

- [ ] **Step 1: Substituir `KanbanColumn.tsx`**

```tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard } from './LeadCard'
import { Badge } from '@/components/ui/badge'
import type { KanbanLead } from './KanbanBoard'

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
  onLeadClick: (lead: KanbanLead) => void
  onLeadDelete: (id: string) => void
}

export function KanbanColumn({ status, label, leads, onLeadClick, onLeadDelete }: KanbanColumnProps) {
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
            <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} onDelete={onLeadDelete} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
```

- [ ] **Step 2: Substituir `LeadCard.tsx`**

```tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { KanbanLead } from './KanbanBoard'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

interface LeadCardProps {
  lead: KanbanLead
  onClick: () => void
  onDelete?: (id: string) => void
}

export function LeadCard({ lead, onClick, onDelete }: LeadCardProps) {
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
              {format(new Date(lead.event_date), "dd 'de' MMM yyyy", { locale: ptBR })}
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

- [ ] **Step 3: Commit**

```bash
git add components/comercial/KanbanColumn.tsx components/comercial/LeadCard.tsx
git commit -m "feat: atualiza KanbanColumn e LeadCard para usar tipo KanbanLead"
```

---

### Task 6: NewLeadButton invalida cache ao criar lead

**Files:**
- Modify: `components/comercial/NewLeadButton.tsx`

Remove `router.refresh()` e passa a invalidar a query `['leads']` via `useQueryClient`. O Kanban atualiza automaticamente com o novo lead sem recarregar a página.

- [ ] **Step 1: Substituir `NewLeadButton.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { LeadForm } from './LeadForm'

export function NewLeadButton() {
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
        <LeadForm onSuccess={handleSuccess} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/comercial/NewLeadButton.tsx
git commit -m "feat: NewLeadButton invalida cache TanStack Query ao criar lead"
```

---

### Task 7: Verificar funcionamento no browser

- [ ] **Step 1: Iniciar o servidor**

```bash
npm run dev
```

Esperado: servidor inicia sem erros de TypeScript ou de compilação.

- [ ] **Step 2: Testar carregamento inicial**

Acessar `http://localhost:3000` e navegar até Comercial. O Kanban deve carregar com os leads existentes.

- [ ] **Step 3: Testar criar lead**

Clicar em "Novo Lead", preencher e salvar. O card deve aparecer na coluna "Novo Lead" **sem recarregar a página**.

- [ ] **Step 4: Testar mover card**

Arrastar um card para outra coluna. O card deve se mover imediatamente (otimista) e permanecer na nova posição.

- [ ] **Step 5: Testar deletar card**

Deletar um lead. O card deve desaparecer imediatamente sem recarregar a página.

- [ ] **Step 6: Testar falha de rede (opcional)**

No DevTools do browser, ativar "Offline" e tentar mover um card. O card deve voltar para a coluna original após a falha.
