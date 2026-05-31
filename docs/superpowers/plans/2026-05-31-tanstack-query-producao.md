# TanStack Query — Produção (Detalhe do Evento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar TanStack Query na página de detalhe do evento para que o contador do checklist atualize em tempo real ao marcar itens, e adicionar/remover músico não recarregue a página.

**Architecture:** O servidor prefetch os dados dinâmicos do evento (checklists + músicos) via `queryClient.setQueryData` e os hidrata via `HydrationBoundary`. Um novo `EventDetailClient` usa `useQuery(['event', eventoId])` e passa os dados para `ChecklistPanel` e `TeamPanel`. As mutações de checklist e equipe invalidam a mesma query, triggering refetch automático.

**Tech Stack:** `@tanstack/react-query` v5, Next.js 14 App Router, TypeScript, Prisma

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx` | Modificar | Adiciona HydrationBoundary + setQueryData; mantém header estático; usa EventDetailClient |
| `components/producao/EventDetailClient.tsx` | Criar | Client Component com useQuery; renderiza ChecklistPanel + TeamPanel |
| `components/producao/ChecklistPanel.tsx` | Modificar | Recebe `eventoId` como prop adicional e repassa para ChecklistItemRow |
| `components/producao/ChecklistItemRow.tsx` | Modificar | Adiciona `eventoId`; substitui useState+fetch por useMutation com atualização otimista |
| `components/producao/TeamPanel.tsx` | Modificar | Remove useState de músicos e router.refresh(); usa useMutation + invalidateQueries |

---

### Task 1: Atualizar page.tsx com HydrationBoundary e EventDetailClient

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx`

O servidor faz uma única query Prisma com todos os dados. Usa `queryClient.setQueryData` para popular o cache sem fazer um segundo fetch. As seções dinâmicas (checklists + equipe) são extraídas para `EventDetailClient`.

- [ ] **Step 1: Substituir o conteúdo de `[eventoId]/page.tsx`**

```tsx
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { EventDetailClient } from '@/components/producao/EventDetailClient'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

const statusLabels: Record<string, string> = {
  contracted: 'Contratado', active: 'Em andamento', done: 'Concluído',
}

const statusColors: Record<string, string> = {
  contracted: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  done: 'bg-gray-100 text-gray-600',
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ bandSlug: string; eventoId: string }>
}) {
  const { eventoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const [event, bandMembers] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventoId, band_id: dbUser.band_id },
      include: {
        checklists: { include: { items: { orderBy: { id: 'asc' } } } },
        event_musicians: {
          include: { user: { select: { id: true, name: true, avatar_url: true } } },
          orderBy: { id: 'asc' },
        },
      },
    }),
    prisma.user.findMany({
      where: { band_id: dbUser.band_id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!event) return notFound()

  const queryClient = new QueryClient()
  queryClient.setQueryData(['event', eventoId], {
    checklists: event.checklists.map(c => ({
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
      items: c.items.map(i => ({
        ...i,
        created_at: i.created_at.toISOString(),
      })),
    })),
    event_musicians: event.event_musicians.map(m => ({
      ...m,
      created_at: m.created_at.toISOString(),
    })),
  })

  const valueFormatted = parseFloat(event.value.toString()).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.client_name}</h1>
            <p className="text-gray-500">
              {format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
              {event.event_time && ` às ${event.event_time}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[event.status] ?? ''}`}>
              {statusLabels[event.status] ?? event.status}
            </span>
            <span className="text-xs text-gray-500">
              {eventTypeLabels[event.event_type] ?? event.event_type}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded-lg p-4">
          <div><span className="font-medium text-gray-700">Local:</span> <span>{event.venue_name}</span></div>
          {event.venue_address && (
            <div><span className="font-medium text-gray-700">Endereço:</span> <span>{event.venue_address}</span></div>
          )}
          <div>
            <span className="font-medium text-gray-700">Som:</span>{' '}
            <span>{event.venue_has_sound ? '✅ Incluso' : '❌ Providenciar'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Luz:</span>{' '}
            <span>{event.venue_has_light ? '✅ Incluso' : '❌ Providenciar'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Valor:</span>{' '}
            <span>R$ {valueFormatted}</span>
          </div>
          {event.technical_visit_date && (
            <div>
              <span className="font-medium text-gray-700">Visita técnica:</span>{' '}
              <span>{format(new Date(event.technical_visit_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
          )}
        </div>

        {event.notes && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Observações</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.notes}</p>
          </div>
        )}

        <EventDetailClient eventoId={eventoId} bandMembers={bandMembers} />
      </div>
    </HydrationBoundary>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx"
git commit -m "feat: adiciona HydrationBoundary e EventDetailClient na página de detalhe do evento"
```

---

### Task 2: Criar EventDetailClient

**Files:**
- Create: `components/producao/EventDetailClient.tsx`

Client Component que lê do cache via `useQuery(['event', eventoId])` e passa os dados para `ChecklistPanel` e `TeamPanel`. Define e exporta os tipos compartilhados `Checklist`, `ChecklistItem` e `EventMusician`.

- [ ] **Step 1: Criar `components/producao/EventDetailClient.tsx`**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { ChecklistPanel } from './ChecklistPanel'
import { TeamPanel } from './TeamPanel'

export type ChecklistItem = {
  id: string
  description: string
  done: boolean
}

export type Checklist = {
  id: string
  title: string
  items: ChecklistItem[]
}

export type EventMusician = {
  id: string
  user_id: string
  instrument: string | null
  status: 'pending' | 'confirmed' | 'declined'
  user: { id: string; name: string; avatar_url: string | null }
}

type EventData = {
  checklists: Checklist[]
  event_musicians: EventMusician[]
}

type BandMember = { id: string; name: string }

type Props = {
  eventoId: string
  bandMembers: BandMember[]
}

async function fetchEventData(eventoId: string): Promise<EventData> {
  const res = await fetch(`/api/events/${eventoId}`)
  if (!res.ok) throw new Error('Falha ao carregar dados do evento')
  const json = await res.json()
  return {
    checklists: json.data.checklists,
    event_musicians: json.data.event_musicians,
  }
}

export function EventDetailClient({ eventoId, bandMembers }: Props) {
  const { data, isError, refetch } = useQuery({
    queryKey: ['event', eventoId],
    queryFn: () => fetchEventData(eventoId),
  })

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-4 text-gray-500">
        <p>Não foi possível carregar os dados do evento.</p>
        <button onClick={() => refetch()} className="text-sm underline hover:text-gray-700">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Checklists Operacionais</h2>
        <ChecklistPanel checklists={data?.checklists ?? []} eventoId={eventoId} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Equipe Escalada</h2>
        <TeamPanel
          eventId={eventoId}
          musicians={data?.event_musicians ?? []}
          bandMembers={bandMembers}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/producao/EventDetailClient.tsx
git commit -m "feat: cria EventDetailClient com useQuery para detalhe do evento"
```

---

### Task 3: Atualizar ChecklistPanel com prop eventoId

**Files:**
- Modify: `components/producao/ChecklistPanel.tsx`

Adiciona `eventoId` às props e repassa para `ChecklistItemRow`. Importa tipos de `EventDetailClient`.

- [ ] **Step 1: Substituir `ChecklistPanel.tsx`**

```tsx
import { ChecklistItemRow } from './ChecklistItemRow'
import type { Checklist } from './EventDetailClient'

type Props = {
  checklists: Checklist[]
  eventoId: string
}

export function ChecklistPanel({ checklists, eventoId }: Props) {
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
                <ChecklistItemRow
                  key={item.id}
                  checklistId={checklist.id}
                  item={item}
                  eventoId={eventoId}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/producao/ChecklistPanel.tsx
git commit -m "feat: ChecklistPanel recebe eventoId e repassa para ChecklistItemRow"
```

---

### Task 4: Refatorar ChecklistItemRow com useMutation

**Files:**
- Modify: `components/producao/ChecklistItemRow.tsx`

Remove `useState` de `done` e `updating`. Usa `useMutation` com atualização otimista do cache via `onMutate`. O estado `done` passa a vir do cache (via prop `item.done`). O estado `isPending` substitui o antigo `updating`.

- [ ] **Step 1: Substituir `ChecklistItemRow.tsx`**

```tsx
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { ChecklistItem } from './EventDetailClient'

type Props = {
  checklistId: string
  item: ChecklistItem
  eventoId: string
}

export function ChecklistItemRow({ checklistId, item, eventoId }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ['event', eventoId]

  const toggleMutation = useMutation({
    mutationFn: async (newDone: boolean) => {
      const res = await fetch(`/api/checklists/${checklistId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, done: newDone }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar item')
    },
    onMutate: async (newDone) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: any) => ({
        ...old,
        checklists: (old?.checklists ?? []).map((c: any) =>
          c.id === checklistId
            ? { ...c, items: c.items.map((i: any) => i.id === item.id ? { ...i, done: newDone } : i) }
            : c
        ),
      }))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return (
    <label className={cn(
      'flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-gray-50 transition-colors',
      toggleMutation.isPending && 'opacity-50'
    )}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => toggleMutation.mutate(!item.done)}
        disabled={toggleMutation.isPending}
        className="h-4 w-4 rounded"
      />
      <span className={cn('text-sm', item.done && 'line-through text-gray-400')}>
        {item.description}
      </span>
    </label>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/producao/ChecklistItemRow.tsx
git commit -m "feat: ChecklistItemRow usa useMutation com atualização otimista do cache"
```

---

### Task 5: Refatorar TeamPanel com useMutation

**Files:**
- Modify: `components/producao/TeamPanel.tsx`

Remove `useState(initialMusicians)`, `useRouter` e `router.refresh()`. Os músicos passam a vir como prop direta (do `useQuery` em `EventDetailClient`). As operações de adicionar e remover usam `useMutation` que invalida `['event', eventId]`.

- [ ] **Step 1: Substituir `TeamPanel.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { EventMusician } from './EventDetailClient'

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-700' },
  declined:  { label: 'Recusou',    className: 'bg-red-100 text-red-700' },
}

type BandMember = { id: string; name: string }

type Props = {
  eventId: string
  musicians: EventMusician[]
  bandMembers: BandMember[]
}

export function TeamPanel({ eventId, musicians, bandMembers }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ['event', eventId]
  const [selectedUserId, setSelectedUserId] = useState('')

  const alreadyAdded = new Set(musicians.map(m => m.user_id))
  const available = bandMembers.filter(m => !alreadyAdded.has(m.id))

  const addMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/event-musicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, user_id: userId }),
      })
      if (!res.ok) throw new Error('Falha ao adicionar músico')
    },
    onSuccess: () => {
      setSelectedUserId('')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/event-musicians?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao remover músico')
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: any) => ({
        ...old,
        event_musicians: (old?.event_musicians ?? []).filter((m: any) => m.id !== id),
      }))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {musicians.length === 0 && (
          <p className="text-gray-400 text-sm">Nenhum músico escalado ainda.</p>
        )}
        {musicians.map(em => {
          const cfg = statusConfig[em.status] ?? statusConfig.pending
          return (
            <div key={em.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                {em.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{em.user.name}</p>
                {em.instrument && <p className="text-xs text-gray-400">{em.instrument}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                {cfg.label}
              </span>
              <button
                onClick={() => {
                  if (window.confirm('Remover músico do evento?')) removeMutation.mutate(em.id)
                }}
                disabled={removeMutation.isPending}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                aria-label="Remover músico"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>

      {available.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Selecionar membro...</option>
            {available.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={() => { if (selectedUserId) addMutation.mutate(selectedUserId) }}
            disabled={!selectedUserId || addMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {addMutation.isPending ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/producao/TeamPanel.tsx
git commit -m "feat: TeamPanel usa useMutation e invalida cache ao adicionar/remover músico"
```

---

### Task 6: Verificar TypeScript e funcionamento

**Files:** nenhum

- [ ] **Step 1: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: nenhum erro.

- [ ] **Step 2: Iniciar servidor**

```bash
npm run dev
```

Esperado: servidor inicia sem erros de compilação.

- [ ] **Step 3: Testar contador do checklist**

Acessar um evento em `/producao/[eventoId]`. Marcar um item de checklist. O contador "X/Y (%)" deve atualizar **imediatamente** sem recarregar a página.

- [ ] **Step 4: Testar adicionar músico**

Selecionar um membro e clicar "Adicionar". O músico deve aparecer na lista **sem recarregar a página**.

- [ ] **Step 5: Testar remover músico**

Clicar no X de um músico e confirmar. O músico deve sumir **instantaneamente** (otimista).

- [ ] **Step 6: Testar rollback (opcional)**

No DevTools, ativar "Offline" e tentar marcar um item. O checkbox deve voltar ao estado original após a falha.
