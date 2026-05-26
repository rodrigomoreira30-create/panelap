# PanelAp — Fase 0: Fundação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o esqueleto completo do projeto: Next.js 14 configurado, schema Prisma com todas as entidades, Supabase com RLS, autenticação funcional e middleware de roles.

**Architecture:** Monolito Modular Next.js 14 App Router. Multi-tenancy via `band_id` com Row Level Security no PostgreSQL (Supabase). Middleware intercepta todas as rotas do dashboard e verifica JWT + role do usuário.

**Tech Stack:** Next.js 14, TypeScript, Prisma 5, PostgreSQL via Supabase, Supabase Auth, Tailwind CSS, shadcn/ui, Vitest.

---

## Mapa de Arquivos

```
panelap/
├── app/
│   ├── layout.tsx                        # Root layout com providers
│   ├── (auth)/
│   │   ├── login/page.tsx                # Página de login
│   │   └── register/page.tsx            # Página de registro de banda
│   └── (dashboard)/
│       └── [bandSlug]/
│           ├── layout.tsx               # Layout do dashboard (sidebar, header)
│           └── page.tsx                 # Home do dashboard
├── components/
│   ├── ui/                              # shadcn/ui (gerado automaticamente)
│   └── shared/
│       ├── BandProvider.tsx             # Context com dados da banda atual
│       └── RoleGuard.tsx               # Componente que bloqueia por role
├── lib/
│   ├── prisma.ts                        # Singleton do PrismaClient
│   ├── supabase/
│   │   ├── client.ts                    # Supabase client-side
│   │   └── server.ts                    # Supabase server-side (cookies)
│   └── events/
│       └── internal-bus.ts             # Event emitter interno entre módulos
├── middleware.ts                        # Protege rotas dashboard + injeta band_id
├── prisma/
│   └── schema.prisma                   # Schema completo com todas entidades
├── types/
│   └── index.ts                        # Tipos TypeScript compartilhados
├── __tests__/
│   └── lib/
│       ├── internal-bus.test.ts
│       └── role-guard.test.tsx
├── vitest.config.ts
├── .env.local.example
└── package.json
```

---

## Task 1: Scaffold do Projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`

- [ ] **Step 1: Criar projeto Next.js**

```bash
npx create-next-app@14 panelap \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd panelap
```

- [ ] **Step 2: Instalar dependências**

```bash
npm install \
  @prisma/client \
  @supabase/supabase-js \
  @supabase/ssr \
  @anthropic-ai/sdk \
  zod \
  date-fns \
  lucide-react \
  class-variance-authority \
  clsx \
  tailwind-merge

npm install -D \
  prisma \
  vitest \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom
```

- [ ] **Step 3: Instalar shadcn/ui**

```bash
npx shadcn-ui@latest init
# Escolher: Default style, Zinc color, CSS variables: yes
npx shadcn-ui@latest add button card badge input label textarea select dialog sheet toast avatar dropdown-menu calendar
```

- [ ] **Step 4: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 5: Criar `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Criar `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic
ANTHROPIC_API_KEY=your-anthropic-key

# ZapSign
ZAPSIGN_API_TOKEN=your-zapsign-token
ZAPSIGN_WEBHOOK_SECRET=your-webhook-secret

# Asaas
ASAAS_API_KEY=your-asaas-key
ASAAS_WEBHOOK_TOKEN=your-webhook-token

# WhatsApp
WHATSAPP_API_URL=https://your-whatsapp-provider.com
WHATSAPP_API_TOKEN=your-token
WHATSAPP_WEBHOOK_SECRET=your-secret

# App
NEXTAUTH_SECRET=your-secret-32-chars-min
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Copiar para `.env.local` e preencher com os valores reais.

- [ ] **Step 7: Adicionar script de teste ao `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js 14 com TypeScript, Tailwind, shadcn/ui e Vitest"
```

---

## Task 2: Schema Prisma Completo

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

- [ ] **Step 1: Inicializar Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Escrever `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum UserRole {
  admin
  commercial
  producer
  musician
}

enum LeadStatus {
  new_lead
  attending
  proposal_sent
  negotiation
  closed
  lost
}

enum EventType {
  wedding
  party
  show
  corporate
  other
}

enum ContractStatus {
  draft
  pending_review
  sent
  signed
}

enum EventStatus {
  contracted
  active
  done
}

enum DocumentType {
  contract
  rider
  briefing
  map
  other
}

enum MessageDirection {
  in
  out
}

enum MusicianConfirmStatus {
  pending
  confirmed
  declined
}

enum SaasPlan {
  starter
  pro
  enterprise
}

model Band {
  id         String   @id @default(cuid())
  name       String
  slug       String   @unique
  plan       SaasPlan @default(starter)
  logo_url   String?
  asaas_id   String?
  created_at DateTime @default(now())

  users             User[]
  leads             Lead[]
  events            Event[]
  contract_templates ContractTemplate[]
  documents         Document[]
}

model User {
  id         String   @id @default(cuid())
  band_id    String
  supabase_id String  @unique
  name       String
  email      String
  role       UserRole
  phone      String?
  avatar_url String?
  created_at DateTime @default(now())

  band            Band            @relation(fields: [band_id], references: [id], onDelete: Cascade)
  assigned_leads  Lead[]          @relation("AssignedLeads")
  event_musicians EventMusician[]
  reviewed_contracts Contract[]   @relation("ReviewedContracts")
  uploaded_docs   Document[]
}

model Lead {
  id               String     @id @default(cuid())
  band_id          String
  client_name      String
  phone            String
  event_type       EventType
  event_date       DateTime?
  city             String?
  venue_name       String?
  venue_has_sound  Boolean    @default(false)
  venue_has_light  Boolean    @default(false)
  budget           Float?
  status           LeadStatus @default(new_lead)
  assigned_to      String?
  observations     String?
  created_at       DateTime   @default(now())
  updated_at       DateTime   @updatedAt

  band     Band      @relation(fields: [band_id], references: [id], onDelete: Cascade)
  assignee User?     @relation("AssignedLeads", fields: [assigned_to], references: [id])
  messages Message[]
  event    Event?
}

model Event {
  id                   String      @id @default(cuid())
  band_id              String
  lead_id              String      @unique
  client_name          String
  event_type           EventType
  event_date           DateTime
  event_time           String?
  venue_name           String
  venue_address        String?
  venue_has_sound      Boolean     @default(false)
  venue_has_light      Boolean     @default(false)
  value                Float
  status               EventStatus @default(contracted)
  technical_visit_date DateTime?
  notes                String?
  created_at           DateTime    @default(now())
  updated_at           DateTime    @updatedAt

  band            Band            @relation(fields: [band_id], references: [id], onDelete: Cascade)
  lead            Lead            @relation(fields: [lead_id], references: [id])
  contracts       Contract[]
  checklists      Checklist[]
  event_musicians EventMusician[]
  documents       Document[]
}

model ContractTemplate {
  id         String   @id @default(cuid())
  band_id    String
  name       String
  content    String
  is_default Boolean  @default(false)
  created_at DateTime @default(now())

  band      Band       @relation(fields: [band_id], references: [id], onDelete: Cascade)
  contracts Contract[]
}

model Contract {
  id           String         @id @default(cuid())
  event_id     String
  template_id  String
  pdf_url      String?
  zapsign_doc_id String?
  zapsign_link String?
  status       ContractStatus @default(draft)
  reviewed_by  String?
  signed_at    DateTime?
  created_at   DateTime       @default(now())
  updated_at   DateTime       @updatedAt

  event      Event            @relation(fields: [event_id], references: [id], onDelete: Cascade)
  template   ContractTemplate @relation(fields: [template_id], references: [id])
  reviewer   User?            @relation("ReviewedContracts", fields: [reviewed_by], references: [id])
}

model Checklist {
  id          String @id @default(cuid())
  event_id    String
  title       String
  assigned_to String?

  event Event          @relation(fields: [event_id], references: [id], onDelete: Cascade)
  items ChecklistItem[]
}

model ChecklistItem {
  id           String    @id @default(cuid())
  checklist_id String
  description  String
  done         Boolean   @default(false)
  due_date     DateTime?

  checklist Checklist @relation(fields: [checklist_id], references: [id], onDelete: Cascade)
}

model EventMusician {
  id           String                @id @default(cuid())
  event_id     String
  user_id      String
  instrument   String?
  status       MusicianConfirmStatus @default(pending)
  confirmed_at DateTime?

  event Event @relation(fields: [event_id], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([event_id, user_id])
}

model Document {
  id          String       @id @default(cuid())
  band_id     String
  event_id    String?
  type        DocumentType
  file_url    String
  file_name   String
  uploaded_by String
  created_at  DateTime     @default(now())

  band     Band   @relation(fields: [band_id], references: [id], onDelete: Cascade)
  event    Event? @relation(fields: [event_id], references: [id])
  uploader User   @relation(fields: [uploaded_by], references: [id])
}

model Message {
  id        String           @id @default(cuid())
  lead_id   String
  direction MessageDirection
  content   String
  sent_by   String
  sent_at   DateTime         @default(now())

  lead Lead @relation(fields: [lead_id], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Criar `lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 4: Configurar variáveis de banco no `.env.local`**

No painel Supabase: Settings → Database → Connection String.
Copiar a URL de **Transaction** para `DATABASE_URL` e a URL **Direct** para `DIRECT_URL`.

```bash
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

- [ ] **Step 5: Rodar migration**

```bash
npx prisma migrate dev --name init
```

Saída esperada:
```
✔ Generated Prisma Client
The following migration(s) have been created and applied:
migrations/20260525000000_init/migration.sql
```

- [ ] **Step 6: Commit**

```bash
git add prisma/ lib/prisma.ts
git commit -m "feat: schema Prisma completo com todas as entidades + singleton client"
```

---

## Task 3: Supabase Auth e RLS

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Execute: SQL de políticas RLS no Supabase SQL Editor

- [ ] **Step 1: Criar `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Criar `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 3: Habilitar RLS nas tabelas no Supabase SQL Editor**

Abrir o Supabase Dashboard → SQL Editor e executar:

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE "Band" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Checklist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventMusician" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: retorna band_id do usuário autenticado
CREATE OR REPLACE FUNCTION auth_band_id()
RETURNS TEXT AS $$
  SELECT band_id FROM "User"
  WHERE supabase_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas: Band
CREATE POLICY "band_own" ON "Band"
  USING (id = auth_band_id());

-- Políticas: User
CREATE POLICY "user_own_band" ON "User"
  USING (band_id = auth_band_id());

-- Políticas: Lead
CREATE POLICY "lead_own_band" ON "Lead"
  USING (band_id = auth_band_id());

-- Políticas: Event
CREATE POLICY "event_own_band" ON "Event"
  USING (band_id = auth_band_id());

-- Políticas: ContractTemplate
CREATE POLICY "template_own_band" ON "ContractTemplate"
  USING (band_id = auth_band_id());

-- Políticas: Contract (via event → band)
CREATE POLICY "contract_own_band" ON "Contract"
  USING (
    event_id IN (
      SELECT id FROM "Event" WHERE band_id = auth_band_id()
    )
  );

-- Políticas: Checklist (via event → band)
CREATE POLICY "checklist_own_band" ON "Checklist"
  USING (
    event_id IN (
      SELECT id FROM "Event" WHERE band_id = auth_band_id()
    )
  );

-- Políticas: ChecklistItem (via checklist → event → band)
CREATE POLICY "checklist_item_own_band" ON "ChecklistItem"
  USING (
    checklist_id IN (
      SELECT c.id FROM "Checklist" c
      JOIN "Event" e ON e.id = c.event_id
      WHERE e.band_id = auth_band_id()
    )
  );

-- Políticas: EventMusician (via event → band)
CREATE POLICY "event_musician_own_band" ON "EventMusician"
  USING (
    event_id IN (
      SELECT id FROM "Event" WHERE band_id = auth_band_id()
    )
  );

-- Políticas: Document
CREATE POLICY "document_own_band" ON "Document"
  USING (band_id = auth_band_id());

-- Políticas: Message (via lead → band)
CREATE POLICY "message_own_band" ON "Message"
  USING (
    lead_id IN (
      SELECT id FROM "Lead" WHERE band_id = auth_band_id()
    )
  );
```

- [ ] **Step 4: Criar bucket no Supabase Storage**

No Supabase Dashboard → Storage → New Bucket:
- Name: `documents`
- Public: false
- File size limit: 50MB

Adicionar política de acesso ao bucket via SQL:

```sql
CREATE POLICY "storage_own_band"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth_band_id()
);
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/
git commit -m "feat: Supabase client/server helpers + RLS policies + Storage bucket"
```

---

## Task 4: Tipos TypeScript Compartilhados

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Criar `types/index.ts`**

```typescript
import type {
  Band, User, Lead, Event, Contract, ContractTemplate,
  Checklist, ChecklistItem, EventMusician, Document, Message,
  UserRole, LeadStatus, EventType, ContractStatus,
  EventStatus, DocumentType, MusicianConfirmStatus,
} from '@prisma/client'

export type {
  Band, User, Lead, Event, Contract, ContractTemplate,
  Checklist, ChecklistItem, EventMusician, Document, Message,
  UserRole, LeadStatus, EventType, ContractStatus,
  EventStatus, DocumentType, MusicianConfirmStatus,
}

// Tipos com relações populadas
export type LeadWithMessages = Lead & { messages: Message[] }
export type LeadWithAssignee = Lead & { assignee: User | null }
export type LeadFull = Lead & { messages: Message[]; assignee: User | null }

export type EventFull = Event & {
  lead: Lead
  contracts: Contract[]
  checklists: (Checklist & { items: ChecklistItem[] })[]
  event_musicians: (EventMusician & { user: User })[]
  documents: Document[]
}

export type ContractFull = Contract & {
  template: ContractTemplate
  event: Event
  reviewer: User | null
}

// Payload de resposta de API
export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: string }

// Context da sessão
export type SessionUser = {
  id: string
  band_id: string
  name: string
  email: string
  role: UserRole
}
```

- [ ] **Step 2: Commit**

```bash
git add types/
git commit -m "feat: tipos TypeScript compartilhados com relações e ApiResponse"
```

---

## Task 5: Middleware de Autenticação e Roles

**Files:**
- Create: `middleware.ts`
- Create: `components/shared/RoleGuard.tsx`
- Create: `components/shared/BandProvider.tsx`
- Create: `__tests__/lib/role-guard.test.tsx`

- [ ] **Step 1: Escrever o teste do RoleGuard**

```typescript
// __tests__/lib/role-guard.test.tsx
import { render, screen } from '@testing-library/react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import type { UserRole } from '@/types'

function makeSession(role: UserRole) {
  return { id: '1', band_id: 'b1', name: 'Test', email: 'a@b.com', role }
}

describe('RoleGuard', () => {
  it('renderiza children quando role está na lista permitida', () => {
    render(
      <RoleGuard user={makeSession('admin')} allowed={['admin', 'commercial']}>
        <span>Conteúdo</span>
      </RoleGuard>
    )
    expect(screen.getByText('Conteúdo')).toBeInTheDocument()
  })

  it('não renderiza children quando role não está na lista', () => {
    render(
      <RoleGuard user={makeSession('musician')} allowed={['admin']}>
        <span>Conteúdo</span>
      </RoleGuard>
    )
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument()
  })

  it('renderiza fallback quando fornecido e role não permitido', () => {
    render(
      <RoleGuard
        user={makeSession('musician')}
        allowed={['admin']}
        fallback={<span>Sem acesso</span>}
      >
        <span>Conteúdo</span>
      </RoleGuard>
    )
    expect(screen.getByText('Sem acesso')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npx vitest run __tests__/lib/role-guard.test.tsx
```

Esperado: FAIL — `Cannot find module '@/components/shared/RoleGuard'`

- [ ] **Step 3: Criar `components/shared/RoleGuard.tsx`**

```typescript
import type { ReactNode } from 'react'
import type { UserRole, SessionUser } from '@/types'

interface RoleGuardProps {
  user: SessionUser
  allowed: UserRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGuard({ user, allowed, children, fallback = null }: RoleGuardProps) {
  if (!allowed.includes(user.role)) return <>{fallback}</>
  return <>{children}</>
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npx vitest run __tests__/lib/role-guard.test.tsx
```

Esperado: PASS (3 testes)

- [ ] **Step 5: Criar `components/shared/BandProvider.tsx`**

```typescript
'use client'

import { createContext, useContext } from 'react'
import type { Band, SessionUser } from '@/types'

interface BandContextValue {
  band: Band
  user: SessionUser
}

const BandContext = createContext<BandContextValue | null>(null)

export function BandProvider({
  band,
  user,
  children,
}: BandContextValue & { children: React.ReactNode }) {
  return (
    <BandContext.Provider value={{ band, user }}>
      {children}
    </BandContext.Provider>
  )
}

export function useBand(): BandContextValue {
  const ctx = useContext(BandContext)
  if (!ctx) throw new Error('useBand deve ser usado dentro de BandProvider')
  return ctx
}
```

- [ ] **Step 6: Criar `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isDashboard = request.nextUrl.pathname.match(/^\/[^/]+\//)

  if (isDashboard && !user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
```

- [ ] **Step 7: Criar `app/(dashboard)/[bandSlug]/layout.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { BandProvider } from '@/components/shared/BandProvider'
import type { SessionUser } from '@/types'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { bandSlug: string }
}) {
  const supabase = createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()

  if (!supabaseUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: supabaseUser.id },
    include: { band: true },
  })

  if (!dbUser || dbUser.band.slug !== params.bandSlug) redirect('/login')

  const sessionUser: SessionUser = {
    id: dbUser.id,
    band_id: dbUser.band_id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
  }

  return (
    <BandProvider band={dbUser.band} user={sessionUser}>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar será adicionada na Fase 1 */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </BandProvider>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add middleware.ts components/shared/ app/ __tests__/
git commit -m "feat: middleware de auth + BandProvider + RoleGuard com testes"
```

---

## Task 6: Event Bus Interno

**Files:**
- Create: `lib/events/internal-bus.ts`
- Create: `__tests__/lib/internal-bus.test.ts`

- [ ] **Step 1: Escrever o teste do event bus**

```typescript
// __tests__/lib/internal-bus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { eventBus } from '@/lib/events/internal-bus'

describe('eventBus', () => {
  it('chama listeners quando evento é emitido', () => {
    const handler = vi.fn()
    eventBus.on('lead.closed', handler)
    eventBus.emit('lead.closed', { lead_id: '123', band_id: 'b1' })
    expect(handler).toHaveBeenCalledWith({ lead_id: '123', band_id: 'b1' })
    eventBus.off('lead.closed', handler)
  })

  it('remove listener corretamente com off', () => {
    const handler = vi.fn()
    eventBus.on('lead.closed', handler)
    eventBus.off('lead.closed', handler)
    eventBus.emit('lead.closed', { lead_id: '123', band_id: 'b1' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('suporta múltiplos listeners no mesmo evento', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    eventBus.on('contract.signed', h1)
    eventBus.on('contract.signed', h2)
    eventBus.emit('contract.signed', { contract_id: 'c1' })
    expect(h1).toHaveBeenCalled()
    expect(h2).toHaveBeenCalled()
    eventBus.off('contract.signed', h1)
    eventBus.off('contract.signed', h2)
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npx vitest run __tests__/lib/internal-bus.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/events/internal-bus'`

- [ ] **Step 3: Criar `lib/events/internal-bus.ts`**

```typescript
type EventMap = {
  'lead.closed':   { lead_id: string; band_id: string }
  'contract.signed': { contract_id: string }
  'event.created': { event_id: string; band_id: string }
  'musician.confirmed': { event_musician_id: string }
}

type EventName = keyof EventMap
type Handler<E extends EventName> = (payload: EventMap[E]) => void | Promise<void>

class InternalEventBus {
  private listeners: Map<EventName, Set<Handler<EventName>>> = new Map()

  on<E extends EventName>(event: E, handler: Handler<E>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler as Handler<EventName>)
  }

  off<E extends EventName>(event: E, handler: Handler<E>): void {
    this.listeners.get(event)?.delete(handler as Handler<EventName>)
  }

  emit<E extends EventName>(event: E, payload: EventMap[E]): void {
    this.listeners.get(event)?.forEach(handler => handler(payload))
  }
}

const globalBus = globalThis as unknown as { __eventBus?: InternalEventBus }
export const eventBus = globalBus.__eventBus ?? new InternalEventBus()
if (process.env.NODE_ENV !== 'production') globalBus.__eventBus = eventBus
```

- [ ] **Step 4: Rodar para confirmar que passa**

```bash
npx vitest run __tests__/lib/internal-bus.test.ts
```

Esperado: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/events/ __tests__/lib/internal-bus.test.ts
git commit -m "feat: event bus interno tipado para comunicação entre módulos"
```

---

## Task 7: Páginas de Auth (Login e Registro)

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/layout.tsx`

- [ ] **Step 1: Criar `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PanelAp — Gestão para Bandas',
  description: 'Plataforma operacional para bandas e artistas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Criar `app/(auth)/login/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    // Buscar band_slug do usuário para redirecionar
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch(`/api/me`)
    const { bandSlug } = await res.json()
    router.push(`/${bandSlug}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">PanelAp</CardTitle>
          <p className="text-center text-gray-500 text-sm">Entre na sua conta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Criar `app/api/me/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: user.id },
    include: { band: { select: { slug: true } } },
  })

  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ bandSlug: dbUser.band.slug })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat: páginas de login e route /api/me"
```

---

## Task 8: Verificação Final da Fundação

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: 6 testes passando (3 RoleGuard + 3 event bus).

- [ ] **Step 2: Rodar build de verificação**

```bash
npm run build
```

Esperado: Build sem erros TypeScript.

- [ ] **Step 3: Testar localmente**

```bash
npm run dev
```

Acessar `http://localhost:3000/login` e verificar que a página de login carrega corretamente.

- [ ] **Step 4: Commit final da fase**

```bash
git add .
git commit -m "feat: Fase 0 completa — fundação Next.js, Prisma, Supabase, RLS, auth, event bus"
```

---

## Checklist da Fase 0

- [ ] Next.js 14 com TypeScript, Tailwind, shadcn/ui funcionando
- [ ] Prisma schema com todas as entidades e migration aplicada
- [ ] Supabase Auth configurado
- [ ] RLS habilitado em todas as tabelas
- [ ] `lib/supabase/client.ts` e `server.ts` criados
- [ ] Tipos TypeScript compartilhados em `types/index.ts`
- [ ] Middleware protegendo rotas do dashboard
- [ ] `BandProvider` e `RoleGuard` implementados e testados
- [ ] Event bus interno tipado e testado
- [ ] Login funcional
- [ ] Build passando sem erros
- [ ] Todos os testes passando

**Próximo:** [Fase 1 — Módulo Comercial](./2026-05-25-fase-1-comercial.md)
