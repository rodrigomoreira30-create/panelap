# Dashboard — Visão Geral do Negócio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o redirect na página inicial da banda por um dashboard com KPIs, gráfico de leads por dia, leads por etapa do pipeline e próximos eventos.

**Architecture:** API endpoint único `GET /api/dashboard?bandSlug=...&days=30` agrega todos os dados via Prisma. Client Component `DashboardClient` usa `useQuery(['dashboard', bandSlug, days])` para buscar e exibir os dados. Seletor de período (7/30/90 dias) dispara nova query automaticamente.

**Tech Stack:** Next.js 14 App Router, TanStack Query v5, Recharts 3, date-fns 4, Prisma, Tailwind CSS.

---

## Estrutura de arquivos

| Arquivo | Ação |
|---|---|
| `app/(dashboard)/[bandSlug]/page.tsx` | Modificar — remove `redirect()`, renderiza `DashboardClient` |
| `app/api/dashboard/route.ts` | Criar — GET endpoint com todos os dados agregados |
| `components/dashboard/DashboardClient.tsx` | Criar — orquestrador: `useQuery`, seletor de período, skeleton, erro |
| `components/dashboard/KpiCards.tsx` | Criar — 3 cards de KPI |
| `components/dashboard/LeadsByDayChart.tsx` | Criar — gráfico de barras verticais (Recharts) |
| `components/dashboard/LeadsByStageChart.tsx` | Criar — barras horizontais por etapa (Recharts) |
| `components/dashboard/UpcomingEvents.tsx` | Criar — lista de próximos eventos |

---

## Task 1: API endpoint `/api/dashboard`

**Files:**
- Create: `app/api/dashboard/route.ts`

- [ ] **Step 1: Criar o arquivo da rota**

```ts
// app/api/dashboard/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const CLOSED_STATUSES = ['closed', 'lost', 'closed_won', 'closed_lost']

const DEFAULT_STAGES = [
  { key: 'new_lead',      label: 'Novo Lead' },
  { key: 'attending',     label: 'Em Atendimento' },
  { key: 'proposal_sent', label: 'Proposta Enviada' },
  { key: 'negotiation',   label: 'Negociação' },
  { key: 'closed',        label: 'Fechado' },
  { key: 'lost',          label: 'Perdido' },
]

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const bandSlug = searchParams.get('bandSlug')
  const daysParam = searchParams.get('days')
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10), 1), 365) : 30

  if (!bandSlug) return NextResponse.json({ error: 'bandSlug is required' }, { status: 400 })

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: user.id },
    include: { band: true },
  })
  if (!dbUser || dbUser.band.slug !== bandSlug) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bandId = dbUser.band.id
  const pipelineStages = (dbUser.band.pipeline_stages as { key: string; label: string }[] | null) ?? DEFAULT_STAGES

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  // KPI: leads abertos (fora dos status de fechamento)
  const leadsAbertos = await prisma.lead.count({
    where: { band_id: bandId, status: { notIn: CLOSED_STATUSES } },
  })

  // KPI: leads novos no período
  const leadsNovos = await prisma.lead.count({
    where: { band_id: bandId, created_at: { gte: startDate } },
  })

  // KPI: faturamento previsto (eventos contratados ou em andamento)
  const activeEvents = await prisma.event.findMany({
    where: { band_id: bandId, status: { in: ['contracted', 'active'] } },
    select: { value: true },
  })
  const faturamentoPrevisto = activeEvents.reduce(
    (sum, e) => sum + parseFloat(e.value.toString()),
    0
  )

  // Leads por dia — todos os dias do intervalo, zeros incluídos
  const leadsInPeriod = await prisma.lead.findMany({
    where: { band_id: bandId, created_at: { gte: startDate } },
    select: { created_at: true },
  })
  const countByDate = new Map<string, number>()
  for (const lead of leadsInPeriod) {
    const dateStr = lead.created_at.toISOString().slice(0, 10)
    countByDate.set(dateStr, (countByDate.get(dateStr) ?? 0) + 1)
  }
  const leadsByDay: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    leadsByDay.push({ date: dateStr, count: countByDate.get(dateStr) ?? 0 })
  }

  // Leads por etapa do pipeline
  const allLeads = await prisma.lead.findMany({
    where: { band_id: bandId },
    select: { status: true },
  })
  const countByStage = new Map<string, number>()
  for (const lead of allLeads) {
    countByStage.set(lead.status, (countByStage.get(lead.status) ?? 0) + 1)
  }
  const leadsByStage = pipelineStages.map(s => ({
    stage: s.label,
    count: countByStage.get(s.key) ?? 0,
  }))

  // Próximos eventos
  const upcoming = await prisma.event.findMany({
    where: { band_id: bandId, event_date: { gte: new Date() } },
    select: { id: true, client_name: true, event_date: true, event_type: true },
    orderBy: { event_date: 'asc' },
    take: 5,
  })
  const upcomingEvents = upcoming.map(e => ({
    id: e.id,
    clientName: e.client_name,
    eventDate: e.event_date.toISOString(),
    eventType: e.event_type,
  }))

  return NextResponse.json({
    data: {
      kpi: { leadsAbertos, faturamentoPrevisto, leadsNovos },
      leadsByDay,
      leadsByStage,
      upcomingEvents,
    },
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npx tsc --noEmit 2>&1 | grep dashboard
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/api/dashboard/route.ts
git commit -m "feat: endpoint GET /api/dashboard com KPIs, leads por dia/etapa e próximos eventos"
```

---

## Task 2: Página inicial — substituir redirect

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/page.tsx`

- [ ] **Step 1: Substituir conteúdo do arquivo**

```tsx
// app/(dashboard)/[bandSlug]/page.tsx
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardHomePage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Visão geral do negócio</p>
      </div>
      <DashboardClient bandSlug={bandSlug} />
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npx tsc --noEmit 2>&1 | grep dashboard
```

Expected: sem erros (DashboardClient ainda não existe — o erro esperado é "Cannot find module", que vai sumir nas tasks seguintes).

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/[bandSlug]/page.tsx"
git commit -m "feat: página inicial renderiza DashboardClient em vez de redirecionar"
```

---

## Task 3: DashboardClient — orquestrador

**Files:**
- Create: `components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Criar o arquivo com tipos, fetch e lógica de período**

```tsx
// components/dashboard/DashboardClient.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KpiCards } from './KpiCards'
import { LeadsByDayChart } from './LeadsByDayChart'
import { LeadsByStageChart } from './LeadsByStageChart'
import { UpcomingEvents } from './UpcomingEvents'

export type DashboardKpi = {
  leadsAbertos: number
  faturamentoPrevisto: number
  leadsNovos: number
}

export type LeadsByDayItem = { date: string; count: number }
export type LeadsByStageItem = { stage: string; count: number }

export type UpcomingEvent = {
  id: string
  clientName: string
  eventDate: string
  eventType: string
}

export type DashboardData = {
  kpi: DashboardKpi
  leadsByDay: LeadsByDayItem[]
  leadsByStage: LeadsByStageItem[]
  upcomingEvents: UpcomingEvent[]
}

async function fetchDashboard(bandSlug: string, days: number): Promise<DashboardData> {
  const res = await fetch(
    `/api/dashboard?bandSlug=${encodeURIComponent(bandSlug)}&days=${days}`
  )
  if (!res.ok) throw new Error('Falha ao carregar dashboard')
  const json = await res.json()
  return json.data
}

const PERIOD_OPTIONS = [
  { value: 7,  label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
]

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 bg-gray-200 rounded-lg" />
        <div className="h-24 bg-gray-200 rounded-lg" />
        <div className="h-24 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-64 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-gray-200 rounded-lg" />
        <div className="h-48 bg-gray-200 rounded-lg" />
      </div>
    </div>
  )
}

export function DashboardClient({ bandSlug }: { bandSlug: string }) {
  const [days, setDays] = useState(30)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', bandSlug, days],
    queryFn: () => fetchDashboard(bandSlug, days),
  })

  if (isLoading) return <DashboardSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-4 text-gray-500">
        <p>Não foi possível carregar o dashboard.</p>
        <button
          onClick={() => refetch()}
          className="text-sm underline hover:text-gray-700"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-1">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setDays(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              days === opt.value
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <KpiCards kpi={data!.kpi} />
      <LeadsByDayChart data={data!.leadsByDay} />
      <div className="grid grid-cols-2 gap-4">
        <LeadsByStageChart data={data!.leadsByStage} />
        <UpcomingEvents events={data!.upcomingEvents} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npx tsc --noEmit 2>&1 | grep -i "dashboard\|KpiCards\|LeadsBy\|UpcomingEvents"
```

Expected: erros de "Cannot find module" para os sub-componentes — normal, serão criados nas tasks seguintes.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DashboardClient.tsx
git commit -m "feat: DashboardClient com useQuery, seletor de período e skeleton"
```

---

## Task 4: KpiCards

**Files:**
- Create: `components/dashboard/KpiCards.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/dashboard/KpiCards.tsx
import type { DashboardKpi } from './DashboardClient'

type Props = { kpi: DashboardKpi }

export function KpiCards({ kpi }: Props) {
  const cards = [
    {
      label: 'Leads abertos',
      value: kpi.leadsAbertos.toString(),
      accent: 'bg-blue-500',
    },
    {
      label: 'Faturamento previsto',
      value: `R$ ${kpi.faturamentoPrevisto.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      accent: 'bg-emerald-500',
    },
    {
      label: 'Leads novos no período',
      value: kpi.leadsNovos.toString(),
      accent: 'bg-violet-500',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-lg border p-5">
          <div className={`inline-flex h-1.5 w-8 rounded-full ${card.accent} mb-4`} />
          <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          <p className="text-sm text-gray-500 mt-1">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npx tsc --noEmit 2>&1 | grep -i "KpiCards\|dashboard"
```

Expected: sem erros relacionados ao KpiCards.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/KpiCards.tsx
git commit -m "feat: KpiCards com leads abertos, faturamento e leads novos"
```

---

## Task 5: LeadsByDayChart

**Files:**
- Create: `components/dashboard/LeadsByDayChart.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/dashboard/LeadsByDayChart.tsx
'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { LeadsByDayItem } from './DashboardClient'

type Props = { data: LeadsByDayItem[] }

export function LeadsByDayChart({ data }: Props) {
  const hasData = data.some(d => d.count > 0)

  const chartData = data.map(d => ({
    ...d,
    label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
  }))

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Leads por dia</h3>
      {!hasData ? (
        <p className="text-gray-400 text-sm">Nenhum lead cadastrado no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: '#f9fafb' }}
              formatter={(value: number) => [value, 'Leads']}
              labelFormatter={(label: string) => `Dia: ${label}`}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npx tsc --noEmit 2>&1 | grep -i "LeadsByDay\|recharts"
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/LeadsByDayChart.tsx
git commit -m "feat: LeadsByDayChart — gráfico de barras de leads por dia com Recharts"
```

---

## Task 6: LeadsByStageChart

**Files:**
- Create: `components/dashboard/LeadsByStageChart.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/dashboard/LeadsByStageChart.tsx
'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { LeadsByStageItem } from './DashboardClient'

type Props = { data: LeadsByStageItem[] }

export function LeadsByStageChart({ data }: Props) {
  const hasData = data.some(d => d.count > 0)

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Leads por etapa</h3>
      {!hasData ? (
        <p className="text-gray-400 text-sm">Nenhum lead cadastrado ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              cursor={{ fill: '#f9fafb' }}
              formatter={(value: number) => [value, 'Leads']}
            />
            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npx tsc --noEmit 2>&1 | grep -i "LeadsByStage"
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/LeadsByStageChart.tsx
git commit -m "feat: LeadsByStageChart — barras horizontais por etapa do pipeline"
```

---

## Task 7: UpcomingEvents

**Files:**
- Create: `components/dashboard/UpcomingEvents.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/dashboard/UpcomingEvents.tsx
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { UpcomingEvent } from './DashboardClient'

const eventTypeLabels: Record<string, string> = {
  wedding:   'Casamento',
  party:     'Festa',
  show:      'Show',
  corporate: 'Corporativo',
  other:     'Outro',
}

type Props = { events: UpcomingEvent[] }

export function UpcomingEvents({ events }: Props) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Próximos eventos</h3>
      {events.length === 0 ? (
        <p className="text-gray-400 text-sm">Nenhum evento próximo.</p>
      ) : (
        <ul className="space-y-3">
          {events.map(ev => (
            <li key={ev.id} className="flex items-start gap-3">
              <div className="min-w-[40px] text-center bg-gray-50 rounded p-1">
                <p className="text-sm font-bold text-gray-900 leading-none">
                  {format(parseISO(ev.eventDate), 'dd', { locale: ptBR })}
                </p>
                <p className="text-xs text-gray-400 uppercase">
                  {format(parseISO(ev.eventDate), 'MMM', { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{ev.clientName}</p>
                <p className="text-xs text-gray-400">
                  {eventTypeLabels[ev.eventType] ?? ev.eventType}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript completo (todos os arquivos)**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/UpcomingEvents.tsx
git commit -m "feat: UpcomingEvents — lista dos próximos 5 eventos da banda"
```

---

## Task 8: Verificação final

**Files:** nenhum

- [ ] **Step 1: Verificar TypeScript limpo**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npx tsc --noEmit 2>&1
```

Expected: nenhuma saída (zero erros).

- [ ] **Step 2: Iniciar servidor de desenvolvimento**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && npm run dev
```

- [ ] **Step 3: Testar no browser**

Abrir `http://localhost:3000/[band-slug]` (substituindo `[band-slug]` pelo slug da banda cadastrada).

Verificar:
- [ ] Dashboard carrega com skeleton e depois mostra os dados
- [ ] 3 cards de KPI aparecem com valores
- [ ] Gráfico "Leads por dia" ocupa toda a largura
- [ ] Seletor de período (7/30/90 dias) funciona — dados atualizam ao clicar
- [ ] Gráfico "Leads por etapa" mostra barras horizontais
- [ ] Lista "Próximos eventos" exibe data + nome + tipo
- [ ] Link "Dashboard" na Sidebar fica destacado (ativo) quando na página inicial
- [ ] Navegar para `/comercial` e voltar ao Dashboard funciona sem erros
