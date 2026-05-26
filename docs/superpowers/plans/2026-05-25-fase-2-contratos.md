# PanelAp — Fase 2: Módulo de Contratos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o módulo de contratos com templates variáveis, geração automática ao fechar lead, fluxo de revisão humana obrigatória, e integração com ZapSign para assinatura digital.

**Architecture:** O event bus escuta `lead.closed` e aciona o agente de contratos (stub na Fase 2, completo na Fase 6). Templates usam sintaxe `{{variavel}}`. Substituição simples via regex. PDF gerado server-side. Webhook ZapSign atualiza status para `signed` e salva documento final.

**Tech Stack:** Next.js 14, Prisma, Zod, ZapSign REST API, Vitest.

**Pré-requisito:** Fase 0 e Fase 1 completas.

---

## Mapa de Arquivos

```
app/
├── (dashboard)/[bandSlug]/contratos/
│   ├── page.tsx                        # Lista de contratos
│   ├── templates/
│   │   └── page.tsx                    # Gerenciar templates
│   └── [contratoId]/
│       └── page.tsx                    # Revisão e aprovação do contrato
├── api/
│   ├── contracts/
│   │   ├── route.ts                    # GET lista, POST criar manualmente
│   │   └── [id]/
│   │       ├── route.ts                # GET detalhe
│   │       └── approve/
│   │           └── route.ts            # POST aprovar contrato
│   ├── contract-templates/
│   │   ├── route.ts                    # GET lista, POST criar
│   │   └── [id]/
│   │       └── route.ts                # PATCH, DELETE
│   └── webhooks/
│       └── zapsign/
│           └── route.ts                # Webhook de assinatura
components/contratos/
├── ContractList.tsx
├── ContractStatusBadge.tsx
├── ContractReview.tsx
├── TemplateEditor.tsx
└── TemplateList.tsx
lib/
├── zapsign/
│   └── client.ts                       # ZapSign REST API client
├── contracts/
│   └── template-fill.ts               # Substituição de variáveis no template
└── validations/
    └── contract.ts
__tests__/lib/
└── template-fill.test.ts
```

---

## Task 1: Lógica de Preenchimento de Template

**Files:**
- Create: `lib/contracts/template-fill.ts`
- Create: `__tests__/lib/template-fill.test.ts`

- [ ] **Step 1: Escrever o teste de preenchimento de template**

```typescript
// __tests__/lib/template-fill.test.ts
import { describe, it, expect } from 'vitest'
import { fillTemplate, extractVariables } from '@/lib/contracts/template-fill'

describe('fillTemplate', () => {
  it('substitui variáveis simples', () => {
    const result = fillTemplate(
      'Contrato entre {{client_name}} e Banda X.',
      { client_name: 'João Silva' }
    )
    expect(result).toBe('Contrato entre João Silva e Banda X.')
  })

  it('substitui múltiplas ocorrências da mesma variável', () => {
    const result = fillTemplate(
      '{{client_name}} confirma. Assinado por {{client_name}}.',
      { client_name: 'Maria' }
    )
    expect(result).toBe('Maria confirma. Assinado por Maria.')
  })

  it('deixa variável sem dado com placeholder visível', () => {
    const result = fillTemplate(
      'Evento em {{city}} no dia {{event_date}}.',
      { city: 'São Paulo' }
    )
    expect(result).toBe('Evento em São Paulo no dia [event_date não informado].')
  })

  it('não altera texto sem variáveis', () => {
    const result = fillTemplate('Texto simples sem variáveis.', {})
    expect(result).toBe('Texto simples sem variáveis.')
  })
})

describe('extractVariables', () => {
  it('extrai nomes de variáveis únicas', () => {
    const vars = extractVariables('{{client_name}} e {{event_date}} e {{client_name}}')
    expect(vars).toEqual(['client_name', 'event_date'])
  })

  it('retorna array vazio para template sem variáveis', () => {
    const vars = extractVariables('Sem variáveis aqui.')
    expect(vars).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npx vitest run __tests__/lib/template-fill.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/contracts/template-fill'`

- [ ] **Step 3: Criar `lib/contracts/template-fill.ts`**

```typescript
export function fillTemplate(content: string, data: Record<string, string | undefined>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] !== undefined && data[key] !== ''
      ? data[key]!
      : `[${key} não informado]`
  })
}

export function extractVariables(content: string): string[] {
  const matches = [...content.matchAll(/\{\{(\w+)\}\}/g)]
  return [...new Set(matches.map(m => m[1]))]
}

export function buildContractData(lead: {
  client_name: string
  phone: string
  event_type: string
  event_date: Date | null
  city: string | null
  venue_name: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  budget: number | null
}): Record<string, string> {
  const eventTypeMap: Record<string, string> = {
    wedding: 'Casamento', party: 'Festa', show: 'Show',
    corporate: 'Corporativo', other: 'Outro',
  }

  return {
    client_name:    lead.client_name,
    client_phone:   lead.phone,
    event_type:     eventTypeMap[lead.event_type] ?? lead.event_type,
    event_date:     lead.event_date
      ? new Intl.DateTimeFormat('pt-BR').format(lead.event_date)
      : '',
    city:           lead.city ?? '',
    venue_name:     lead.venue_name ?? '',
    venue_has_sound: lead.venue_has_sound ? 'Incluso' : 'Não incluso',
    venue_has_light: lead.venue_has_light ? 'Incluso' : 'Não incluso',
    value:          lead.budget
      ? `R$ ${lead.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '',
    today:          new Intl.DateTimeFormat('pt-BR').format(new Date()),
  }
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

```bash
npx vitest run __tests__/lib/template-fill.test.ts
```

Esperado: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/contracts/ __tests__/lib/template-fill.test.ts
git commit -m "feat: preenchimento de template de contrato com variáveis {{...}}"
```

---

## Task 2: ZapSign API Client

**Files:**
- Create: `lib/zapsign/client.ts`

- [ ] **Step 1: Criar `lib/zapsign/client.ts`**

```typescript
const ZAPSIGN_BASE = 'https://api.zapsign.com.br/api/v1'

interface CreateDocumentParams {
  name: string
  url_pdf: string
  signers: Array<{ name: string; email: string; phone_country: string; phone_number: string }>
  external_id?: string
  lang?: string
}

interface ZapSignDocument {
  token: string
  name: string
  external_id: string | null
  signers: Array<{ token: string; sign_url: string; name: string; email: string }>
}

async function zapRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown
): Promise<T> {
  const res = await fetch(`${ZAPSIGN_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ZAPSIGN_API_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZapSign ${method} ${path} → ${res.status}: ${text}`)
  }

  return res.json()
}

export async function createZapSignDocument(
  params: CreateDocumentParams
): Promise<ZapSignDocument> {
  return zapRequest<ZapSignDocument>('/docs/', 'POST', {
    name: params.name,
    url_pdf: params.url_pdf,
    lang: params.lang ?? 'pt-br',
    external_id: params.external_id,
    signers: params.signers.map(s => ({
      name: s.name,
      email: s.email,
      phone_country: s.phone_country,
      phone_number: s.phone_number,
      send_automatic_email: true,
      send_automatic_whatsapp: true,
    })),
  })
}

export async function getZapSignDocument(docToken: string): Promise<ZapSignDocument> {
  return zapRequest<ZapSignDocument>(`/docs/${docToken}/`, 'GET')
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/zapsign/
git commit -m "feat: ZapSign API client para criação e consulta de documentos"
```

---

## Task 3: Validações e API de Templates

**Files:**
- Create: `lib/validations/contract.ts`
- Create: `app/api/contract-templates/route.ts`
- Create: `app/api/contract-templates/[id]/route.ts`

- [ ] **Step 1: Criar `lib/validations/contract.ts`**

```typescript
import { z } from 'zod'

export const templateCreateSchema = z.object({
  name:       z.string().min(2, 'Nome obrigatório'),
  content:    z.string().min(10, 'Conteúdo muito curto'),
  is_default: z.boolean().optional().default(false),
})

export const templateUpdateSchema = templateCreateSchema.partial()

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>
```

- [ ] **Step 2: Criar `app/api/contract-templates/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { templateCreateSchema } from '@/lib/validations/contract'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.contractTemplate.findMany({
    where: { band_id: sessionUser.band_id },
    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
  })

  return NextResponse.json({ data: templates })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = templateCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Se is_default: true, remover default dos outros
  if (parsed.data.is_default) {
    await prisma.contractTemplate.updateMany({
      where: { band_id: sessionUser.band_id, is_default: true },
      data: { is_default: false },
    })
  }

  const template = await prisma.contractTemplate.create({
    data: { ...parsed.data, band_id: sessionUser.band_id },
  })

  return NextResponse.json({ data: template }, { status: 201 })
}
```

- [ ] **Step 3: Criar `app/api/contract-templates/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { templateUpdateSchema } from '@/lib/validations/contract'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = templateUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const existing = await prisma.contractTemplate.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (parsed.data.is_default) {
    await prisma.contractTemplate.updateMany({
      where: { band_id: sessionUser.band_id, is_default: true },
      data: { is_default: false },
    })
  }

  const updated = await prisma.contractTemplate.update({
    where: { id: params.id },
    data: parsed.data,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await prisma.contractTemplate.findUnique({
    where: { id: params.id, band_id: sessionUser.band_id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.contractTemplate.delete({ where: { id: params.id } })
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/validations/contract.ts app/api/contract-templates/
git commit -m "feat: API CRUD de templates de contrato"
```

---

## Task 4: API de Contratos e Fluxo de Aprovação

**Files:**
- Create: `app/api/contracts/route.ts`
- Create: `app/api/contracts/[id]/route.ts`
- Create: `app/api/contracts/[id]/approve/route.ts`

- [ ] **Step 1: Criar `app/api/contracts/route.ts`**

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

  const contracts = await prisma.contract.findMany({
    where: {
      event: { band_id: sessionUser.band_id },
      ...(status ? { status: status as any } : {}),
    },
    include: {
      event: { select: { id: true, client_name: true, event_date: true } },
      template: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ data: contracts })
}
```

- [ ] **Step 2: Criar `app/api/contracts/[id]/route.ts`**

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

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contract = await prisma.contract.findFirst({
    where: {
      id: params.id,
      event: { band_id: sessionUser.band_id },
    },
    include: {
      event: { include: { lead: true } },
      template: true,
      reviewer: { select: { id: true, name: true } },
    },
  })

  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: contract })
}
```

- [ ] **Step 3: Criar `app/api/contracts/[id]/approve/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { createZapSignDocument } from '@/lib/zapsign/client'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id } })
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['admin', 'commercial'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: params.id,
      status: 'pending_review',
      event: { band_id: sessionUser.band_id },
    },
    include: {
      event: { include: { lead: true } },
      template: true,
    },
  })

  if (!contract) {
    return NextResponse.json(
      { error: 'Contrato não encontrado ou não está aguardando revisão' },
      { status: 404 }
    )
  }

  if (!contract.pdf_url) {
    return NextResponse.json({ error: 'PDF do contrato não gerado ainda' }, { status: 400 })
  }

  // Enviar para ZapSign
  const zapDoc = await createZapSignDocument({
    name: `Contrato — ${contract.event.client_name}`,
    url_pdf: contract.pdf_url,
    external_id: contract.id,
    signers: [
      {
        name: contract.event.client_name,
        email: `${contract.event.lead.phone}@placeholder.com`, // substituir por email real quando disponível
        phone_country: '55',
        phone_number: contract.event.lead.phone,
      },
    ],
  })

  const signUrl = zapDoc.signers[0]?.sign_url ?? ''

  // Atualizar contrato
  const updated = await prisma.contract.update({
    where: { id: params.id },
    data: {
      status: 'sent',
      reviewed_by: sessionUser.id,
      zapsign_doc_id: zapDoc.token,
      zapsign_link: signUrl,
    },
  })

  // Enviar link de assinatura via WhatsApp
  if (signUrl) {
    await sendWhatsAppMessage({
      to: contract.event.lead.phone,
      message:
        `Olá ${contract.event.client_name}! 🎵\n` +
        `Seu contrato está pronto para assinatura.\n` +
        `Acesse o link abaixo para assinar:\n${signUrl}`,
    }).catch(err => console.error('WhatsApp send failed:', err))
  }

  return NextResponse.json({ data: updated })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/contracts/
git commit -m "feat: API de contratos com fluxo de aprovação e envio para ZapSign"
```

---

## Task 5: Webhook ZapSign (Assinatura)

**Files:**
- Create: `app/api/webhooks/zapsign/route.ts`

- [ ] **Step 1: Criar `app/api/webhooks/zapsign/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const secret = request.headers.get('x-zapsign-webhook-token')

  if (secret !== process.env.ZAPSIGN_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const payload = await request.json()

  // ZapSign envia evento 'doc_signed' quando o documento é assinado
  if (payload.event_type !== 'doc_signed') {
    return NextResponse.json({ ok: true })
  }

  const docToken: string = payload.document?.token
  if (!docToken) return NextResponse.json({ ok: true })

  const contract = await prisma.contract.findFirst({
    where: { zapsign_doc_id: docToken },
    include: { event: { select: { id: true, band_id: true } } },
  })

  if (!contract) {
    console.warn(`ZapSign webhook: contrato não encontrado para token ${docToken}`)
    return NextResponse.json({ ok: true })
  }

  // Atualizar status do contrato para 'signed'
  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: 'signed',
      signed_at: new Date(),
    },
  })

  // Salvar PDF assinado como Document
  const signedPdfUrl: string = payload.document?.signed_file ?? ''
  if (signedPdfUrl) {
    await prisma.document.create({
      data: {
        band_id: contract.event.band_id,
        event_id: contract.event_id,
        type: 'contract',
        file_url: signedPdfUrl,
        file_name: `contrato-assinado-${contract.id}.pdf`,
        uploaded_by: 'system',
      },
    })
  }

  // Emitir evento interno para pós-venda (Fase 6)
  // eventBus.emit('contract.signed', { contract_id: contract.id })

  return NextResponse.json({ ok: true })
}
```

> **Nota:** O `uploaded_by` usa `'system'` por enquanto. Na Fase 6 isso será conectado ao usuário admin da banda.

- [ ] **Step 2: Commit**

```bash
git add app/api/webhooks/zapsign/
git commit -m "feat: webhook ZapSign atualiza contrato para signed e salva PDF nos documentos"
```

---

## Task 6: Listener do Event Bus para lead.closed

**Files:**
- Create: `lib/contracts/on-lead-closed.ts`
- Modify: `app/api/leads/[id]/route.ts` (registrar listener na inicialização)

- [ ] **Step 1: Criar `lib/contracts/on-lead-closed.ts`**

Este stub cria o contrato em `draft` automaticamente ao fechar o lead. O Agente IA (Fase 6) fará o preenchimento real; aqui apenas garante que o registro existe.

```typescript
import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'
import { fillTemplate, buildContractData } from './template-fill'

export function registerContractLeadClosedListener() {
  eventBus.on('lead.closed', async ({ lead_id, band_id }) => {
    try {
      const lead = await prisma.lead.findUnique({ where: { id: lead_id } })
      if (!lead) return

      // Verificar se já existe evento criado para este lead
      const existingEvent = await prisma.event.findUnique({ where: { lead_id } })
      if (!existingEvent) return // Event criado pela Fase 3 (Produção)

      // Buscar template padrão
      const template = await prisma.contractTemplate.findFirst({
        where: { band_id, is_default: true },
      })
      if (!template) {
        console.warn(`Nenhum template padrão para banda ${band_id}`)
        return
      }

      // Verificar se já existe contrato para este evento
      const existingContract = await prisma.contract.findFirst({
        where: { event_id: existingEvent.id },
      })
      if (existingContract) return

      // Preencher template com dados do lead
      const data = buildContractData(lead)
      const filledContent = fillTemplate(template.content, data)

      // Criar contrato em pending_review (PDF será gerado pelo agente na Fase 6)
      await prisma.contract.create({
        data: {
          event_id: existingEvent.id,
          template_id: template.id,
          status: 'pending_review',
          // pdf_url será preenchida pelo agente na Fase 6
        },
      })

      console.log(`Contrato criado para evento ${existingEvent.id}`)
    } catch (err) {
      console.error('Erro ao criar contrato após lead.closed:', err)
    }
  })
}
```

- [ ] **Step 2: Registrar listener na inicialização da aplicação**

Criar `app/api/_init/route.ts` não é o jeito correto em Next.js. Em vez disso, registrar via `instrumentation.ts` (Next.js 14 suporta):

```typescript
// instrumentation.ts (na raiz do projeto)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerContractLeadClosedListener } = await import('@/lib/contracts/on-lead-closed')
    const { registerProductionLeadClosedListener } = await import('@/lib/production/on-lead-closed')
    registerContractLeadClosedListener()
    registerProductionLeadClosedListener()
    console.log('Event bus listeners registrados')
  }
}
```

> **Nota:** `registerProductionLeadClosedListener` será criado na Fase 3.

- [ ] **Step 3: Habilitar instrumentation no `next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = nextConfig
```

- [ ] **Step 4: Commit**

```bash
git add lib/contracts/on-lead-closed.ts instrumentation.ts next.config.js
git commit -m "feat: listener lead.closed cria contrato automaticamente em pending_review"
```

---

## Task 7: Componentes do Módulo de Contratos

**Files:**
- Create: `components/contratos/ContractStatusBadge.tsx`
- Create: `components/contratos/ContractList.tsx`
- Create: `components/contratos/ContractReview.tsx`
- Create: `components/contratos/TemplateEditor.tsx`

- [ ] **Step 1: Criar `components/contratos/ContractStatusBadge.tsx`**

```typescript
import { Badge } from '@/components/ui/badge'
import type { ContractStatus } from '@/types'

const config: Record<ContractStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft:          { label: 'Rascunho',          variant: 'secondary' },
  pending_review: { label: 'Aguardando revisão', variant: 'outline' },
  sent:           { label: 'Enviado',            variant: 'default' },
  signed:         { label: 'Assinado ✅',        variant: 'default' },
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const { label, variant } = config[status] ?? { label: status, variant: 'secondary' }
  return <Badge variant={variant}>{label}</Badge>
}
```

- [ ] **Step 2: Criar `components/contratos/ContractList.tsx`**

```typescript
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ContractStatusBadge } from './ContractStatusBadge'
import type { Contract, Event, ContractTemplate } from '@/types'

type ContractWithRelations = Contract & {
  event: Pick<Event, 'id' | 'client_name' | 'event_date'>
  template: Pick<ContractTemplate, 'id' | 'name'>
}

interface ContractListProps {
  contracts: ContractWithRelations[]
  bandSlug: string
}

export function ContractList({ contracts, bandSlug }: ContractListProps) {
  if (contracts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Nenhum contrato ainda.</p>
        <p className="text-sm mt-1">Contratos são gerados automaticamente ao fechar um lead.</p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {contracts.map(contract => (
        <Link
          key={contract.id}
          href={`/${bandSlug}/contratos/${contract.id}`}
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div>
            <p className="font-medium">{contract.event.client_name}</p>
            <p className="text-sm text-gray-500">{contract.template.name}</p>
            {contract.event.event_date && (
              <p className="text-xs text-gray-400">
                {format(new Date(contract.event.event_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </div>
          <ContractStatusBadge status={contract.status} />
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Criar `components/contratos/ContractReview.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ContractStatusBadge } from './ContractStatusBadge'
import type { ContractFull } from '@/types'
import { fillTemplate, buildContractData } from '@/lib/contracts/template-fill'

interface ContractReviewProps {
  contract: ContractFull
}

export function ContractReview({ contract }: ContractReviewProps) {
  const router = useRouter()
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')

  const filledContent = fillTemplate(
    contract.template.content,
    buildContractData(contract.event.lead as any)
  )

  async function handleApprove() {
    setApproving(true)
    setError('')

    const res = await fetch(`/api/contracts/${contract.id}/approve`, { method: 'POST' })

    if (!res.ok) {
      const { error } = await res.json()
      setError(error ?? 'Erro ao aprovar contrato')
      setApproving(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{contract.event.client_name}</h2>
          <p className="text-gray-500 text-sm">Template: {contract.template.name}</p>
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>

      {/* Preview do contrato preenchido */}
      <div className="border rounded-lg p-6 bg-white prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm">
        {filledContent}
      </div>

      {contract.status === 'pending_review' && (
        <div className="flex gap-3">
          {error && <p className="text-red-500 text-sm self-center">{error}</p>}
          <Button onClick={handleApprove} disabled={approving} className="ml-auto">
            {approving ? 'Enviando para ZapSign...' : 'Aprovar e Enviar para Assinatura'}
          </Button>
        </div>
      )}

      {contract.status === 'sent' && contract.zapsign_link && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Contrato enviado para assinatura.{' '}
            <a
              href={contract.zapsign_link}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Ver no ZapSign
            </a>
          </p>
        </div>
      )}

      {contract.status === 'signed' && (
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-700">✅ Contrato assinado.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Criar `components/contratos/TemplateEditor.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { extractVariables } from '@/lib/contracts/template-fill'
import type { ContractTemplate } from '@/types'

const AVAILABLE_VARS = [
  'client_name', 'client_phone', 'event_type', 'event_date',
  'city', 'venue_name', 'venue_has_sound', 'venue_has_light', 'value', 'today',
]

interface TemplateEditorProps {
  template?: ContractTemplate
  onSave?: () => void
}

export function TemplateEditor({ template, onSave }: TemplateEditorProps) {
  const router = useRouter()
  const [name, setName] = useState(template?.name ?? '')
  const [content, setContent] = useState(template?.content ?? '')
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const usedVars = extractVariables(content)

  async function handleSave() {
    setSaving(true)
    setError('')

    const url = template ? `/api/contract-templates/${template.id}` : '/api/contract-templates'
    const method = template ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content, is_default: isDefault }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      setError(typeof error === 'string' ? error : 'Erro ao salvar template')
      setSaving(false)
      return
    }

    onSave?.()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Nome do template</Label>
        <Input value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div>
        <Label>Variáveis disponíveis</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {AVAILABLE_VARS.map(v => (
            <button
              key={v}
              type="button"
              className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded font-mono"
              onClick={() => setContent(c => c + `{{${v}}}`)}
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Clique para inserir no conteúdo</p>
      </div>

      <div>
        <Label>Conteúdo do contrato</Label>
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
        />
      </div>

      {usedVars.length > 0 && (
        <div>
          <p className="text-xs text-gray-500">
            Variáveis detectadas: {usedVars.map(v => `{{${v}}}`).join(', ')}
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={e => setIsDefault(e.target.checked)}
        />
        Template padrão
      </label>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : template ? 'Atualizar template' : 'Criar template'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/contratos/
git commit -m "feat: componentes do módulo de contratos (list, review, template editor)"
```

---

## Task 8: Páginas do Módulo de Contratos

**Files:**
- Create: `app/(dashboard)/[bandSlug]/contratos/page.tsx`
- Create: `app/(dashboard)/[bandSlug]/contratos/templates/page.tsx`
- Create: `app/(dashboard)/[bandSlug]/contratos/[contratoId]/page.tsx`

- [ ] **Step 1: Criar `app/(dashboard)/[bandSlug]/contratos/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ContractList } from '@/components/contratos/ContractList'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ContratosPage({ params }: { params: { bandSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const contracts = await prisma.contract.findMany({
    where: { event: { band_id: dbUser.band_id } },
    include: {
      event: { select: { id: true, client_name: true, event_date: true } },
      template: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-gray-500 text-sm">Gerados automaticamente ao fechar leads</p>
        </div>
        <Link href={`/${params.bandSlug}/contratos/templates`}>
          <Button variant="outline">Gerenciar Templates</Button>
        </Link>
      </div>
      <div className="border rounded-lg bg-white">
        <ContractList contracts={contracts} bandSlug={params.bandSlug} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `app/(dashboard)/[bandSlug]/contratos/templates/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TemplateEditor } from '@/components/contratos/TemplateEditor'
import { TemplateList } from '@/components/contratos/TemplateList'

export default async function TemplatesPage({ params }: { params: { bandSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser || dbUser.role !== 'admin') redirect(`/${params.bandSlug}/contratos`)

  const templates = await prisma.contractTemplate.findMany({
    where: { band_id: dbUser.band_id },
    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
  })

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Templates de Contrato</h1>
        <p className="text-gray-500 text-sm">Use {'{{variavel}}'} para campos dinâmicos</p>
      </div>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="font-semibold mb-3">Templates existentes</h2>
          <TemplateList templates={templates} bandSlug={params.bandSlug} />
        </div>
        <div>
          <h2 className="font-semibold mb-3">Novo template</h2>
          <TemplateEditor />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar `components/contratos/TemplateList.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TemplateEditor } from './TemplateEditor'
import type { ContractTemplate } from '@/types'

interface TemplateListProps {
  templates: ContractTemplate[]
  bandSlug: string
}

export function TemplateList({ templates, bandSlug }: TemplateListProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<ContractTemplate | null>(null)

  if (templates.length === 0) {
    return <p className="text-gray-400 text-sm">Nenhum template criado ainda.</p>
  }

  if (editing) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setEditing(null)} className="mb-4">
          ← Voltar
        </Button>
        <TemplateEditor template={editing} onSave={() => { setEditing(null); router.refresh() }} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {templates.map(t => (
        <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <p className="font-medium text-sm">{t.name}</p>
            {t.is_default && <Badge variant="secondary" className="text-xs mt-0.5">Padrão</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>Editar</Button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Criar `app/(dashboard)/[bandSlug]/contratos/[contratoId]/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ContractReview } from '@/components/contratos/ContractReview'

export default async function ContractDetailPage({
  params,
}: { params: { bandSlug: string; contratoId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const contract = await prisma.contract.findFirst({
    where: {
      id: params.contratoId,
      event: { band_id: dbUser.band_id },
    },
    include: {
      event: { include: { lead: true } },
      template: true,
      reviewer: { select: { id: true, name: true } },
    },
  })

  if (!contract) notFound()

  return (
    <div className="max-w-3xl">
      <ContractReview contract={contract as any} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/ components/contratos/
git commit -m "feat: páginas do módulo de contratos — lista, templates, revisão e aprovação"
```

---

## Task 9: Verificação Final do Módulo de Contratos

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

1. Criar um template de contrato com variáveis como `{{client_name}}` e `{{event_date}}`
2. Criar um lead e mover para status "Fechado" no Kanban
3. Verificar que contrato foi criado em `pending_review` na lista de contratos
4. Abrir o contrato e verificar preview com variáveis preenchidas
5. Clicar "Aprovar" (com ZapSign configurado) e verificar envio

- [ ] **Step 4: Commit final da fase**

```bash
git add .
git commit -m "feat: Fase 2 completa — Módulo de Contratos com templates, geração automática, aprovação e ZapSign"
```

---

## Checklist da Fase 2

- [ ] Função `fillTemplate` testada e funcionando
- [ ] Função `buildContractData` mapeando campos do lead para variáveis
- [ ] API de templates CRUD funcionando
- [ ] API de contratos GET funcionando
- [ ] Rota de aprovação envia para ZapSign e retorna link
- [ ] Webhook ZapSign atualiza status para `signed` e salva PDF
- [ ] Listener `lead.closed` cria contrato em `pending_review`
- [ ] `instrumentation.ts` registra listeners na inicialização
- [ ] Componentes de lista, revisão e template editor funcionando
- [ ] Páginas de contratos e templates renderizando corretamente
- [ ] Todos os testes passando

**Próximo:** [Fase 3 — Módulo de Produção](./2026-05-25-fase-3-producao.md)
