# Agenda dos Músicos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Músico recebe um link público com todos os seus shows futuros e botão para exportar ao Google Calendar via `.ics`.

**Architecture:** Adiciona `schedule_token` ao modelo `User` (campo único gerado uma vez). Página pública `/musico/[token]` lê os `event_musicians` futuros do músico sem autenticação. Endpoint `/api/ics/[token]` gera o arquivo `.ics`. TeamPanel expõe botão "Copiar link" por músico.

**Tech Stack:** Next.js 14 App Router, Prisma 7, TanStack Query, date-fns, Vitest, Tailwind CSS, Lucide icons.

---

## File Structure

**Criar:**
- `lib/ics.ts` — função pura `generateICS()` (testável sem mocks)
- `app/api/ics/[token]/route.ts` — endpoint público GET que retorna `.ics`
- `app/musico/[token]/layout.tsx` — layout minimalista (fora do dashboard)
- `app/musico/[token]/page.tsx` — página pública de agenda do músico
- `__tests__/api/ics.test.ts` — testes unitários do gerador ICS

**Modificar:**
- `prisma/schema.prisma` — adiciona `schedule_token String @unique @default(cuid())` ao User
- `app/api/events/[id]/route.ts` — inclui `schedule_token` no select do `user`
- `components/producao/EventDetailClient.tsx` — adiciona `schedule_token` ao tipo `EventMusician.user`
- `components/producao/TeamPanel.tsx` — botão "Copiar link" por músico

---

### Task 1: Adicionar schedule_token ao schema e banco

**Files:**
- Modify: `prisma/schema.prisma`
- Create (temp): `_add_schedule_token.mjs` (deletar após uso)

- [ ] **Step 1: Adicionar campo ao schema**

Abrir `prisma/schema.prisma`. Localizar o model `User` (linha ~83). Adicionar o campo após `avatar_url`:

```prisma
model User {
  id          String   @id @default(cuid())
  band_id     String
  supabase_id String   @unique
  name        String
  email       String
  role        UserRole
  phone       String?
  avatar_url  String?
  schedule_token String @unique @default(cuid())
  created_at  DateTime @default(now())

  band               Band            @relation(fields: [band_id], references: [id], onDelete: Cascade)
  assigned_leads     Lead[]          @relation("AssignedLeads")
  event_musicians    EventMusician[]
  reviewed_contracts Contract[]      @relation("ReviewedContracts")
  uploaded_docs      Document[]

  @@unique([band_id, email])
  @@index([band_id])
}
```

- [ ] **Step 2: Criar script de migração do banco**

Criar o arquivo `_add_schedule_token.mjs` na raiz do projeto:

```js
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { Pool } = require('pg')

const env = readFileSync('.env.local', 'utf-8')
const directUrl = env.match(/DIRECT_URL="([^"]+)"/)?.[1]
if (!directUrl) { console.error('DIRECT_URL não encontrado'); process.exit(1) }

const pool = new Pool({ connectionString: directUrl, ssl: { rejectUnauthorized: false } })

try {
  // Adiciona coluna nullable primeiro
  await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schedule_token" TEXT;`)
  console.log('✓ Coluna schedule_token adicionada')

  // Popula usuários existentes com token único
  const { rows } = await pool.query(`SELECT id FROM "User" WHERE "schedule_token" IS NULL`)
  for (const row of rows) {
    await pool.query(
      `UPDATE "User" SET "schedule_token" = md5(random()::text || $1) WHERE id = $1`,
      [row.id]
    )
  }
  console.log(`✓ schedule_token gerado para ${rows.length} usuários existentes`)

  // Define NOT NULL e UNIQUE após popular
  await pool.query(`ALTER TABLE "User" ALTER COLUMN "schedule_token" SET NOT NULL`)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "User_schedule_token_key" ON "User"("schedule_token")`)
  console.log('✓ Coluna marcada como NOT NULL + UNIQUE index criado')

  console.log('\n✅ Migração concluída!')
} catch (err) {
  console.error('Erro:', err.message)
} finally {
  await pool.end()
}
```

- [ ] **Step 3: Executar migração e gerar client**

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
node _add_schedule_token.mjs
npx prisma generate
```

Saída esperada:
```
✓ Coluna schedule_token adicionada
✓ schedule_token gerado para N usuários existentes
✓ Coluna marcada como NOT NULL + UNIQUE index criado
✅ Migração concluída!
✔ Generated Prisma Client (7.x.x) to ./lib/generated/prisma in Xms
```

- [ ] **Step 4: Remover script temporário**

```bash
rm _add_schedule_token.mjs
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/generated/prisma/
git commit -m "feat: adiciona schedule_token ao modelo User para agenda pública"
```

---

### Task 2: Função geradora de ICS e testes

**Files:**
- Create: `lib/ics.ts`
- Create: `__tests__/api/ics.test.ts`

- [ ] **Step 1: Escrever o teste que deve falhar**

Criar `__tests__/api/ics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateICS } from '@/lib/ics'

describe('generateICS', () => {
  it('gera ICS válido com um evento sem horário', () => {
    const result = generateICS('João Silva', [
      {
        id: 'em-1',
        client_name: 'Maria Santos',
        event_type: 'wedding',
        event_date: new Date('2026-08-15T00:00:00.000Z'),
        event_time: null,
        venue_name: 'Buffet das Flores',
        venue_address: null,
        status: 'confirmed',
      },
    ])
    expect(result).toContain('BEGIN:VCALENDAR')
    expect(result).toContain('BEGIN:VEVENT')
    expect(result).toContain('SUMMARY:Maria Santos - Casamento')
    expect(result).toContain('DTSTART;VALUE=DATE:20260815')
    expect(result).toContain('LOCATION:Buffet das Flores')
    expect(result).toContain('UID:em-1@panelap')
    expect(result).toContain('DESCRIPTION:Status: Confirmado')
    expect(result).toContain('END:VEVENT')
    expect(result).toContain('END:VCALENDAR')
  })

  it('inclui horário quando event_time está presente', () => {
    const result = generateICS('João Silva', [
      {
        id: 'em-2',
        client_name: 'Carlos',
        event_type: 'show',
        event_date: new Date('2026-09-20T00:00:00.000Z'),
        event_time: '20:00',
        venue_name: 'Teatro Municipal',
        venue_address: 'Rua das Flores, 100',
        status: 'pending',
      },
    ])
    expect(result).toContain('DTSTART:20260920T200000')
    expect(result).toContain('DESCRIPTION:Status: Pendente')
  })

  it('gera ICS válido com lista vazia', () => {
    const result = generateICS('João Silva', [])
    expect(result).toContain('BEGIN:VCALENDAR')
    expect(result).not.toContain('BEGIN:VEVENT')
    expect(result).toContain('END:VCALENDAR')
  })
})
```

- [ ] **Step 2: Confirmar que o teste falha**

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
npx vitest run __tests__/api/ics.test.ts
```

Saída esperada: `FAIL` com "Cannot find module '@/lib/ics'"

- [ ] **Step 3: Implementar lib/ics.ts**

Criar `lib/ics.ts`:

```ts
export type ICSEvent = {
  id: string
  client_name: string
  event_type: string
  event_date: Date
  event_time: string | null
  venue_name: string
  venue_address: string | null
  status: string
}

const eventTypeLabels: Record<string, string> = {
  wedding:   'Casamento',
  party:     'Festa',
  show:      'Show',
  corporate: 'Corporativo',
  other:     'Outro',
}

const statusLabels: Record<string, string> = {
  pending:   'Pendente',
  confirmed: 'Confirmado',
  declined:  'Recusado',
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatDTSTART(date: Date, time: string | null): { prop: string; value: string } {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  if (time) {
    const [h, min = '00'] = time.split(':')
    return { prop: 'DTSTART', value: `${y}${m}${d}T${h.padStart(2, '0')}${min.padStart(2, '0')}00` }
  }
  return { prop: 'DTSTART;VALUE=DATE', value: `${y}${m}${d}` }
}

export function generateICS(musicianName: string, events: ICSEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PanelAp//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const ev of events) {
    const { prop, value } = formatDTSTART(ev.event_date, ev.event_time)
    const summary  = escapeICS(`${ev.client_name} - ${eventTypeLabels[ev.event_type] ?? ev.event_type}`)
    const location = ev.venue_address
      ? escapeICS(`${ev.venue_name}, ${ev.venue_address}`)
      : escapeICS(ev.venue_name)
    const description = escapeICS(`Status: ${statusLabels[ev.status] ?? ev.status}`)

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@panelap`,
      `SUMMARY:${summary}`,
      `${prop}:${value}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
```

- [ ] **Step 4: Confirmar que os testes passam**

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
npx vitest run __tests__/api/ics.test.ts
```

Saída esperada: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/ics.ts __tests__/api/ics.test.ts
git commit -m "feat: função generateICS com testes (agenda dos músicos)"
```

---

### Task 3: Endpoint GET /api/ics/[token]

**Files:**
- Create: `app/api/ics/[token]/route.ts`

- [ ] **Step 1: Criar o endpoint**

Criar `app/api/ics/[token]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateICS, type ICSEvent } from '@/lib/ics'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const musician = await prisma.user.findUnique({
    where: { schedule_token: token },
    select: {
      name: true,
      event_musicians: {
        where: { event: { event_date: { gte: new Date() } } },
        select: {
          id: true,
          status: true,
          event: {
            select: {
              client_name: true,
              event_type: true,
              event_date: true,
              event_time: true,
              venue_name: true,
              venue_address: true,
            },
          },
        },
        orderBy: { event: { event_date: 'asc' } },
      },
    },
  })

  if (!musician) return new NextResponse(null, { status: 404 })

  const events: ICSEvent[] = musician.event_musicians.map(em => ({
    id:            em.id,
    client_name:   em.event.client_name,
    event_type:    em.event.event_type,
    event_date:    em.event.event_date,
    event_time:    em.event.event_time,
    venue_name:    em.event.venue_name,
    venue_address: em.event.venue_address,
    status:        em.status,
  }))

  const ics = generateICS(musician.name, events)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="minha-agenda.ics"',
      'Cache-Control':       'no-store',
    },
  })
}
```

- [ ] **Step 2: Testar manualmente**

Com o servidor rodando, abrir no browser ou executar:
```bash
# Pegar um schedule_token de algum usuário:
# No app, adicionar músico a um evento e copiar o token via DB ou log temporário.
# Ou rodar:
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
node -e "
const { Pool } = require('./node_modules/pg');
const env = require('fs').readFileSync('.env.local','utf-8');
const url = env.match(/DIRECT_URL=\"([^\"]+)\"/)?.[1];
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
pool.query('SELECT name, schedule_token FROM \"User\" LIMIT 1').then(r => { console.log(r.rows[0]); pool.end(); });
"
```

Depois acessar `http://localhost:3000/api/ics/{schedule_token}` — deve iniciar download do arquivo `.ics`.

- [ ] **Step 3: Commit**

```bash
git add app/api/ics/
git commit -m "feat: endpoint GET /api/ics/[token] para exportação de agenda"
```

---

### Task 4: Página pública /musico/[token]

**Files:**
- Create: `app/musico/[token]/layout.tsx`
- Create: `app/musico/[token]/page.tsx`

- [ ] **Step 1: Criar o layout**

Criar `app/musico/[token]/layout.tsx`:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Minha Agenda — PanelAp',
}

export default function MusicianLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 2: Criar a página**

Criar `app/musico/[token]/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, MapPin, Music, Download } from 'lucide-react'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Aguardando confirmação', className: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmado',              className: 'bg-green-100 text-green-700' },
  declined:  { label: 'Recusado',                className: 'bg-red-100 text-red-700' },
}

export default async function MusicianSchedulePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const musician = await prisma.user.findUnique({
    where: { schedule_token: token },
    select: {
      name: true,
      event_musicians: {
        where: { event: { event_date: { gte: new Date() } } },
        select: {
          id: true,
          status: true,
          event: {
            select: {
              client_name: true,
              event_type: true,
              event_date: true,
              event_time: true,
              venue_name: true,
              venue_address: true,
            },
          },
        },
        orderBy: { event: { event_date: 'asc' } },
      },
    },
  })

  if (!musician) notFound()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <Music size={28} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{musician.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Sua agenda de shows</p>
        </div>

        <a
          href={`/api/ics/${token}`}
          download="minha-agenda.ics"
          className="flex items-center justify-center gap-2 w-full mb-6 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Exportar para Google Calendar
        </a>

        {musician.event_musicians.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <Calendar size={40} className="mx-auto mb-3 opacity-50" />
            <p>Nenhum show agendado por enquanto.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {musician.event_musicians.map(em => {
              const cfg = statusConfig[em.status] ?? statusConfig.pending
              const eventDate = format(
                new Date(em.event.event_date),
                "EEEE, d 'de' MMMM yyyy",
                { locale: ptBR }
              )
              return (
                <div key={em.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{em.event.client_name}</p>
                      <p className="text-sm text-gray-500">
                        {eventTypeLabels[em.event.event_type] ?? em.event.event_type}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      {eventDate}{em.event.event_time ? ` às ${em.event.event_time}` : ''}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-gray-400 shrink-0" />
                      {em.event.venue_name}
                      {em.event.venue_address ? ` — ${em.event.venue_address}` : ''}
                    </p>
                  </div>
                  {em.status === 'pending' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <a
                        href={`/api/musicians/${em.id}/confirm?action=confirm`}
                        className="flex-1 text-center py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        ✓ Confirmar presença
                      </a>
                      <a
                        href={`/api/musicians/${em.id}/confirm?action=decline`}
                        className="flex-1 text-center py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium border border-red-200"
                      >
                        ✗ Recusar
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Testar manualmente**

Com o servidor rodando, acessar `http://localhost:3000/musico/{schedule_token}` de um usuário do banco. Verificar:
- Nome aparece no topo
- Eventos futuros listados com data, local, status
- Botões confirmar/recusar aparecem quando status = pending
- Botão de exportar presente

- [ ] **Step 4: Commit**

```bash
git add app/musico/
git commit -m "feat: página pública /musico/[token] com agenda do músico"
```

---

### Task 5: Botão "Copiar link" no TeamPanel

**Files:**
- Modify: `app/api/events/[id]/route.ts` (linha 20 — select do user)
- Modify: `components/producao/EventDetailClient.tsx` (tipo EventMusician)
- Modify: `components/producao/TeamPanel.tsx` (botão de copiar)

- [ ] **Step 1: Incluir schedule_token na API de eventos**

Em `app/api/events/[id]/route.ts`, localizar o include do `event_musicians` (linha ~19). Alterar o select do `user` para incluir `schedule_token`:

```ts
event_musicians: {
  include: {
    user: { select: { id: true, name: true, avatar_url: true, schedule_token: true } },
  },
  orderBy: { id: 'asc' },
},
```

- [ ] **Step 2: Atualizar tipo EventMusician**

Em `components/producao/EventDetailClient.tsx`, alterar o tipo `EventMusician`:

```ts
export type EventMusician = {
  id: string
  user_id: string
  instrument: string | null
  status: 'pending' | 'confirmed' | 'declined'
  user: { id: string; name: string; avatar_url: string | null; schedule_token: string }
}
```

- [ ] **Step 3: Adicionar botão no TeamPanel**

Em `components/producao/TeamPanel.tsx`, fazer as seguintes alterações:

**a) Adicionar imports (topo do arquivo):**
```ts
import { useState } from 'react'
import { X, Link2, Check } from 'lucide-react'
```
*(substituir o import existente de `X` do lucide)*

**b) Adicionar estado de cópia no componente:**
```ts
const [copiedId, setCopiedId] = useState<string | null>(null)

function handleCopyLink(token: string, musicianId: string) {
  const url = `${window.location.origin}/musico/${token}`
  navigator.clipboard.writeText(url).then(() => {
    setCopiedId(musicianId)
    setTimeout(() => setCopiedId(null), 2000)
  })
}
```

**c) Adicionar botão no card de cada músico** (antes do botão de remover X):
```tsx
<button
  onClick={() => handleCopyLink(em.user.schedule_token, em.id)}
  className="text-gray-400 hover:text-blue-500 transition-colors p-0.5"
  aria-label="Copiar link da agenda"
  title="Copiar link da agenda"
>
  {copiedId === em.id
    ? <Check size={14} className="text-green-500" />
    : <Link2 size={14} />}
</button>
```

O arquivo completo de `components/producao/TeamPanel.tsx` após as alterações:

```tsx
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Link2, Check } from 'lucide-react'
import type { EventData, EventMusician } from './EventDetailClient'

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
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const alreadyAdded = new Set(musicians.map(m => m.user_id))
  const available = bandMembers.filter(m => !alreadyAdded.has(m.id))

  function handleCopyLink(token: string, musicianId: string) {
    const url = `${window.location.origin}/musico/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(musicianId)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

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
    onError: () => {
      console.error('Falha ao adicionar músico ao evento')
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
      queryClient.setQueryData<EventData>(queryKey, (old) => {
        if (!old) return old
        return { ...old, event_musicians: old.event_musicians.filter((m) => m.id !== id) }
      })
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
                onClick={() => handleCopyLink(em.user.schedule_token, em.id)}
                className="text-gray-400 hover:text-blue-500 transition-colors p-0.5"
                aria-label="Copiar link da agenda"
                title="Copiar link da agenda"
              >
                {copiedId === em.id
                  ? <Check size={14} className="text-green-500" />
                  : <Link2 size={14} />}
              </button>
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

- [ ] **Step 4: Rodar TypeScript para confirmar sem erros**

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
npx tsc --noEmit 2>&1 | head -20
```

Saída esperada: sem erros.

- [ ] **Step 5: Testar manualmente**

1. Acessar um evento em Produção
2. Adicionar um músico à Equipe Escalada
3. Verificar que o ícone de link aparece no card do músico
4. Clicar no ícone → ícone vira checkmark verde por 2 segundos
5. Colar o link copiado no browser → página de agenda do músico abre

- [ ] **Step 6: Commit**

```bash
git add app/api/events/[id]/route.ts components/producao/
git commit -m "feat: botão copiar link da agenda no TeamPanel"
```
