# PanelAp — Fase 4: Módulo de Agenda

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o módulo de agenda com calendário de eventos, detecção de conflitos de data, escala de músicos com confirmação de presença e alertas automáticos.

**Architecture:** Calendário client-side mostra todos os eventos da banda por mês. Músico acessa link de confirmação via `/api/musicians/[id]/confirm`. Detecção de conflito verifica se algum `EventMusician` já existe na mesma data com status `confirmed`. O listener de `event.created` envia notificações de confirmação.

**Tech Stack:** Next.js 14, Prisma, `react-big-calendar`, Vitest.

**Pré-requisito:** Fases 0–3 completas.

---

## Mapa de Arquivos

```
app/
├── (dashboard)/[bandSlug]/agenda/
│   └── page.tsx                        # Calendário de eventos
├── api/
│   ├── agenda/
│   │   └── route.ts                    # GET eventos formatados para calendário
│   └── musicians/
│       └── [id]/
│           └── confirm/
│               └── route.ts            # POST confirmar/recusar presença
components/agenda/
├── CalendarView.tsx                    # Wrapper do react-big-calendar
└── EventPopover.tsx                    # Popover ao clicar no evento
lib/
├── agenda/
│   ├── conflict-detector.ts           # Detecta conflitos por data
│   └── on-event-created.ts            # Listener: notifica músicos
└── validations/
    └── confirm.ts
__tests__/lib/
└── conflict-detector.test.ts
```

---

## Task 1: Instalar react-big-calendar

- [ ] **Step 1: Instalar dependência**

```bash
npm install react-big-calendar date-fns
npm install -D @types/react-big-calendar
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adicionar react-big-calendar para módulo de agenda"
```

---

## Task 2: Detecção de Conflitos de Agenda

**Files:**
- Create: `lib/agenda/conflict-detector.ts`
- Create: `__tests__/lib/conflict-detector.test.ts`

- [ ] **Step 1: Escrever o teste**

```typescript
// __tests__/lib/conflict-detector.test.ts
import { describe, it, expect } from 'vitest'
import { isSameDay, detectConflict } from '@/lib/agenda/conflict-detector'

describe('isSameDay', () => {
  it('retorna true para datas no mesmo dia', () => {
    expect(isSameDay(new Date('2026-06-15T10:00:00'), new Date('2026-06-15T22:00:00'))).toBe(true)
  })

  it('retorna false para datas em dias diferentes', () => {
    expect(isSameDay(new Date('2026-06-15'), new Date('2026-06-16'))).toBe(false)
  })
})

describe('detectConflict', () => {
  const bookedDates = [
    new Date('2026-06-15T18:00:00'),
    new Date('2026-06-20T20:00:00'),
  ]

  it('detecta conflito para data já reservada', () => {
    expect(detectConflict(new Date('2026-06-15T09:00:00'), bookedDates)).toBe(true)
  })

  it('não detecta conflito para data livre', () => {
    expect(detectConflict(new Date('2026-06-17'), bookedDates)).toBe(false)
  })

  it('retorna false para lista vazia', () => {
    expect(detectConflict(new Date('2026-06-15'), [])).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npx vitest run __tests__/lib/conflict-detector.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/agenda/conflict-detector'`

- [ ] **Step 3: Criar `lib/agenda/conflict-detector.ts`**

```typescript
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function detectConflict(targetDate: Date, bookedDates: Date[]): boolean {
  return bookedDates.some(d => isSameDay(d, targetDate))
}

export async function getConflictingEvents(
  bandId: string,
  targetDate: Date,
  excludeEventId?: string
): Promise<string[]> {
  const { prisma } = await import('@/lib/prisma')

  const events = await prisma.event.findMany({
    where: {
      band_id: bandId,
      status: { in: ['contracted', 'active'] },
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    },
    select: { id: true, event_date: true, client_name: true },
  })

  return events
    .filter(e => isSameDay(new Date(e.event_date), targetDate))
    .map(e => e.id)
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

```bash
npx vitest run __tests__/lib/conflict-detector.test.ts
```

Esperado: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/agenda/ __tests__/lib/conflict-detector.test.ts
git commit -m "feat: detecção de conflitos de agenda por data"
```

---

## Task 3: Listener event.created — Notificações de Músicos

**Files:**
- Create: `lib/agenda/on-event-created.ts`
- Modify: `instrumentation.ts`

- [ ] **Step 1: Criar `lib/agenda/on-event-created.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function registerAgendaEventCreatedListener() {
  eventBus.on('event.created', async ({ event_id, band_id }) => {
    try {
      const event = await prisma.event.findUnique({
        where: { id: event_id },
        include: {
          event_musicians: {
            include: { user: { select: { id: true, name: true, phone: true } } },
          },
        },
      })

      if (!event) return

      const dateStr = format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })

      for (const em of event.event_musicians) {
        if (!em.user.phone) continue

        const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/musicians/${em.id}/confirm?action=confirm`
        const declineUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/musicians/${em.id}/confirm?action=decline`

        await sendWhatsAppMessage({
          to: em.user.phone,
          message:
            `Olá ${em.user.name}! 🎵\n` +
            `Você foi escalado para o evento:\n` +
            `📅 ${dateStr}\n` +
            `📍 ${event.venue_name} — ${event.client_name}\n\n` +
            `Confirmar: ${confirmUrl}\n` +
            `Recusar: ${declineUrl}`,
        }).catch(err => console.error(`Falha ao notificar músico ${em.user.id}:`, err))
      }
    } catch (err) {
      console.error('Erro no listener event.created (agenda):', err)
    }
  })
}
```

- [ ] **Step 2: Adicionar ao `instrumentation.ts`**

```typescript
// Adicionar no bloco register() após os listeners existentes:
const { registerAgendaEventCreatedListener } = await import('@/lib/agenda/on-event-created')
registerAgendaEventCreatedListener()
```

- [ ] **Step 3: Commit**

```bash
git add lib/agenda/on-event-created.ts instrumentation.ts
git commit -m "feat: listener event.created notifica músicos escalados via WhatsApp"
```

---

## Task 4: API da Agenda e Confirmação de Músicos

**Files:**
- Create: `app/api/agenda/route.ts`
- Create: `app/api/musicians/[id]/confirm/route.ts`
- Create: `lib/validations/confirm.ts`

- [ ] **Step 1: Criar `lib/validations/confirm.ts`**

```typescript
import { z } from 'zod'
export const confirmSchema = z.object({
  action: z.enum(['confirm', 'decline']),
})
```

- [ ] **Step 2: Criar `app/api/agenda/route.ts`**

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
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const events = await prisma.event.findMany({
    where: {
      band_id: sessionUser.band_id,
      event_date: { gte: start, lte: end },
    },
    include: {
      event_musicians: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { event_date: 'asc' },
  })

  // Formatar para react-big-calendar
  const calendarEvents = events.map(e => ({
    id:    e.id,
    title: `${e.client_name} — ${e.venue_name}`,
    start: new Date(e.event_date),
    end:   new Date(e.event_date),
    resource: {
      status:   e.status,
      type:     e.event_type,
      musicians: e.event_musicians.map(em => em.user.name),
    },
  }))

  return NextResponse.json({ data: calendarEvents })
}
```

- [ ] **Step 3: Criar `app/api/musicians/[id]/confirm/route.ts`**

Este endpoint aceita tanto GET (para links de WhatsApp) quanto POST (para chamadas API).

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action !== 'confirm' && action !== 'decline') {
    return new Response('<html><body><h1>Link inválido</h1></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const em = await prisma.eventMusician.findUnique({
    where: { id: params.id },
    include: { event: { select: { client_name: true, event_date: true } } },
  })

  if (!em) {
    return new Response('<html><body><h1>Convite não encontrado</h1></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (em.status !== 'pending') {
    return new Response(
      `<html><body><h1>Você já respondeu este convite: ${em.status === 'confirmed' ? '✅ Confirmado' : '❌ Recusado'}</h1></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined'

  await prisma.eventMusician.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      confirmed_at: newStatus === 'confirmed' ? new Date() : undefined,
    },
  })

  const message = newStatus === 'confirmed'
    ? `✅ Presença confirmada! Evento: ${em.event.client_name}`
    : `❌ Presença recusada. Obrigado por informar.`

  return new Response(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>${message}</h1></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}))
  const action = body.action

  if (action !== 'confirm' && action !== 'decline') {
    return NextResponse.json({ error: 'action deve ser "confirm" ou "decline"' }, { status: 422 })
  }

  const em = await prisma.eventMusician.findUnique({ where: { id: params.id } })
  if (!em) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined'

  const updated = await prisma.eventMusician.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      confirmed_at: newStatus === 'confirmed' ? new Date() : undefined,
    },
  })

  return NextResponse.json({ data: updated })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/agenda/ app/api/musicians/ lib/validations/confirm.ts
git commit -m "feat: API de agenda + endpoint de confirmação de presença de músicos"
```

---

## Task 5: Componentes do Calendário

**Files:**
- Create: `components/agenda/CalendarView.tsx`
- Create: `components/agenda/EventPopover.tsx`

- [ ] **Step 1: Criar `components/agenda/EventPopover.tsx`**

```typescript
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'

const statusColors: Record<string, string> = {
  contracted: 'bg-blue-500',
  active:     'bg-orange-500',
  done:       'bg-gray-400',
}

const typeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  resource: {
    status: string
    type: string
    musicians: string[]
  }
}

interface EventPopoverProps {
  event: CalendarEvent
}

export function EventPopover({ event }: EventPopoverProps) {
  return (
    <div className="p-3 space-y-2 max-w-xs">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColors[event.resource.status] ?? 'bg-gray-400'}`} />
        <span className="font-medium text-sm">{event.title}</span>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p>{format(event.start, "dd 'de' MMMM yyyy", { locale: ptBR })}</p>
        <p>Tipo: {typeLabels[event.resource.type] ?? event.resource.type}</p>
        {event.resource.musicians.length > 0 && (
          <p>Músicos: {event.resource.musicians.join(', ')}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `components/agenda/CalendarView.tsx`**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import {
  format, parse, startOfWeek, getDay,
  startOfMonth, endOfMonth, addMonths, subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EventPopover } from './EventPopover'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales: { 'pt-BR': ptBR },
})

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: { status: string; type: string; musicians: string[] }
}

interface CalendarViewProps {
  initialEvents: CalendarEvent[]
}

export function CalendarView({ initialEvents }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('month')
  const [loadingMonth, setLoadingMonth] = useState(false)

  async function loadMonth(date: Date) {
    setLoadingMonth(true)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const res = await fetch(`/api/agenda?year=${year}&month=${month}`)
    if (res.ok) {
      const { data } = await res.json()
      setEvents(
        data.map((e: any) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end),
        }))
      )
    }
    setLoadingMonth(false)
  }

  function handleNavigate(date: Date) {
    setCurrentDate(date)
    loadMonth(date)
  }

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors: Record<string, string> = {
      contracted: '#3b82f6',
      active:     '#f97316',
      done:       '#9ca3af',
    }
    return {
      style: {
        backgroundColor: colors[event.resource.status] ?? '#6b7280',
        borderRadius: '4px',
        border: 'none',
        color: 'white',
        fontSize: '12px',
        padding: '1px 4px',
      },
    }
  }, [])

  return (
    <div className={`h-[600px] ${loadingMonth ? 'opacity-60' : ''}`}>
      <Calendar
        localizer={localizer}
        events={events}
        view={view}
        onView={setView}
        date={currentDate}
        onNavigate={handleNavigate}
        culture="pt-BR"
        messages={{
          next: 'Próximo', previous: 'Anterior', today: 'Hoje',
          month: 'Mês', week: 'Semana', day: 'Dia',
        }}
        eventPropGetter={eventStyleGetter}
        components={{
          event: ({ event }) => (
            <Popover>
              <PopoverTrigger asChild>
                <span className="block truncate">{event.title}</span>
              </PopoverTrigger>
              <PopoverContent>
                <EventPopover event={event as CalendarEvent} />
              </PopoverContent>
            </Popover>
          ),
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/agenda/
git commit -m "feat: CalendarView com react-big-calendar e popover de detalhes do evento"
```

---

## Task 6: Página de Agenda

**Files:**
- Create: `app/(dashboard)/[bandSlug]/agenda/page.tsx`

- [ ] **Step 1: Criar `app/(dashboard)/[bandSlug]/agenda/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarView } from '@/components/agenda/CalendarView'
import { startOfMonth, endOfMonth } from 'date-fns'

export default async function AgendaPage({ params }: { params: { bandSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  // Carregar eventos do mês atual no servidor (SSR)
  const now = new Date()
  const events = await prisma.event.findMany({
    where: {
      band_id: dbUser.band_id,
      event_date: {
        gte: startOfMonth(now),
        lte: endOfMonth(now),
      },
    },
    include: {
      event_musicians: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { event_date: 'asc' },
  })

  const calendarEvents = events.map(e => ({
    id:    e.id,
    title: `${e.client_name} — ${e.venue_name}`,
    start: e.event_date,
    end:   e.event_date,
    resource: {
      status:   e.status,
      type:     e.event_type,
      musicians: e.event_musicians.map(em => em.user.name),
    },
  }))

  const upcomingWithoutConfirmation = await prisma.eventMusician.findMany({
    where: {
      status: 'pending',
      event: {
        band_id: dbUser.band_id,
        event_date: { gte: now },
      },
    },
    include: {
      event: { select: { client_name: true, event_date: true } },
      user: { select: { name: true } },
    },
    orderBy: { event: { event_date: 'asc' } },
    take: 10,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-gray-500 text-sm">Calendário centralizado da banda</p>
      </div>

      {upcomingWithoutConfirmation.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="font-medium text-yellow-800 text-sm mb-2">
            ⚠️ Confirmações pendentes ({upcomingWithoutConfirmation.length})
          </p>
          <ul className="space-y-1">
            {upcomingWithoutConfirmation.map(em => (
              <li key={em.id} className="text-sm text-yellow-700">
                {em.user.name} — {em.event.client_name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CalendarView initialEvents={calendarEvents} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/
git commit -m "feat: página de agenda com calendário SSR e alerta de confirmações pendentes"
```

---

## Task 7: Verificação Final do Módulo de Agenda

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos passando (incluindo os 5 testes de conflict-detector).

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: sem erros TypeScript.

- [ ] **Step 3: Testar fluxo completo**

1. Navegar para `/agenda`
2. Verificar que eventos do mês atual aparecem no calendário
3. Clicar em um evento e verificar popover com detalhes
4. Navegar para meses anteriores/posteriores e verificar carregamento
5. Testar link de confirmação: acessar `/api/musicians/[id]/confirm?action=confirm`

- [ ] **Step 4: Commit final da fase**

```bash
git add .
git commit -m "feat: Fase 4 completa — Módulo de Agenda com calendário, conflitos e confirmação de músicos"
```

---

## Checklist da Fase 4

- [ ] `isSameDay` e `detectConflict` testados (5 testes)
- [ ] Listener `event.created` notifica músicos via WhatsApp
- [ ] API `/api/agenda` retorna eventos formatados para calendário
- [ ] Endpoint de confirmação GET (link WhatsApp) funcionando
- [ ] Endpoint de confirmação POST (API) funcionando
- [ ] `CalendarView` com navegação por mês e popover
- [ ] Alerta de confirmações pendentes na página de agenda
- [ ] Todos os testes passando

**Próximo:** [Fase 5 — Módulo de Documentos](./2026-05-25-fase-5-documentos.md)
