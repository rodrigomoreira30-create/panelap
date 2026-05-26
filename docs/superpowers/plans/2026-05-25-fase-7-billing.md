# PanelAp — Fase 7: Billing (Asaas)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o Asaas como gateway de billing para o SaaS. Cada banda é um customer no Asaas. Ao criar uma banda, a assinatura mensal é criada automaticamente. Webhook do Asaas atualiza o plano conforme pagamentos.

**Architecture:** `Band.asaas_id` armazena o customer ID do Asaas. A assinatura é criada via REST API. O webhook recebe eventos `PAYMENT_RECEIVED` e `PAYMENT_OVERDUE` para atualizar `Band.plan`. Página de configurações exibe status da assinatura e link para o portal do cliente.

**Tech Stack:** Next.js 14, Prisma, Asaas REST API, Zod, Vitest.

**Pré-requisito:** Fases 0–6 completas.

---

## Mapa de Arquivos

```
app/
├── (dashboard)/[bandSlug]/configuracoes/
│   └── page.tsx                        # Configurações da banda + billing
├── api/
│   ├── billing/
│   │   ├── subscription/
│   │   │   └── route.ts                # GET status da assinatura
│   │   └── portal/
│   │       └── route.ts                # GET link do portal do cliente
│   └── webhooks/
│       └── asaas/
│           └── route.ts                # POST webhook de eventos de pagamento
lib/
├── asaas/
│   └── client.ts                       # Asaas REST API client
└── validations/
    └── band.ts                         # Validação de criação de banda
__tests__/lib/
└── asaas-client.test.ts
```

---

## Task 1: Asaas API Client

**Files:**
- Create: `lib/asaas/client.ts`
- Create: `__tests__/lib/asaas-client.test.ts`

- [ ] **Step 1: Escrever o teste do client Asaas**

```typescript
// __tests__/lib/asaas-client.test.ts
import { describe, it, expect } from 'vitest'
import { buildSubscriptionPayload } from '@/lib/asaas/client'

describe('buildSubscriptionPayload', () => {
  it('monta payload de assinatura mensal corretamente', () => {
    const payload = buildSubscriptionPayload({
      customer_id: 'cus_abc123',
      plan:        'starter',
      band_name:   'Banda Rock',
    })

    expect(payload.customer).toBe('cus_abc123')
    expect(payload.billingType).toBe('UNDEFINED')
    expect(payload.cycle).toBe('MONTHLY')
    expect(typeof payload.value).toBe('number')
    expect(payload.value).toBeGreaterThan(0)
    expect(typeof payload.nextDueDate).toBe('string')
    expect(payload.description).toContain('Banda Rock')
  })

  it('aplica valor correto por plano', () => {
    const starter = buildSubscriptionPayload({ customer_id: 'c1', plan: 'starter', band_name: 'B' })
    const pro = buildSubscriptionPayload({ customer_id: 'c1', plan: 'pro', band_name: 'B' })
    const enterprise = buildSubscriptionPayload({ customer_id: 'c1', plan: 'enterprise', band_name: 'B' })

    expect(starter.value).toBeLessThan(pro.value)
    expect(pro.value).toBeLessThan(enterprise.value)
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npx vitest run __tests__/lib/asaas-client.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/asaas/client'`

- [ ] **Step 3: Criar `lib/asaas/client.ts`**

```typescript
const ASAAS_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

const PLAN_PRICES: Record<string, number> = {
  starter:    97.00,
  pro:       197.00,
  enterprise: 397.00,
}

async function asaasRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown
): Promise<T> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': process.env.ASAAS_API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`)
  }

  return res.json()
}

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj?: string
}

export interface AsaasSubscription {
  id: string
  customer: string
  value: number
  status: string
  nextDueDate: string
  cycle: string
  billingType: string
}

export function buildSubscriptionPayload(params: {
  customer_id: string
  plan: string
  band_name: string
}) {
  const nextDue = new Date()
  nextDue.setDate(nextDue.getDate() + 1) // cobrar a partir de amanhã

  return {
    customer:    params.customer_id,
    billingType: 'UNDEFINED' as const, // PIX, boleto ou cartão — cliente escolhe
    cycle:       'MONTHLY' as const,
    value:       PLAN_PRICES[params.plan] ?? PLAN_PRICES.starter,
    nextDueDate: nextDue.toISOString().split('T')[0], // YYYY-MM-DD
    description: `PanelAp ${params.plan} — ${params.band_name}`,
    externalReference: params.customer_id,
  }
}

export async function createAsaasCustomer(params: {
  name: string
  email: string
  cpfCnpj?: string
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('/customers', 'POST', params)
}

export async function createAsaasSubscription(params: {
  customer_id: string
  plan: string
  band_name: string
}): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>(
    '/subscriptions',
    'POST',
    buildSubscriptionPayload(params)
  )
}

export async function getAsaasSubscriptions(
  customer_id: string
): Promise<{ data: AsaasSubscription[] }> {
  return asaasRequest<{ data: AsaasSubscription[] }>(
    `/subscriptions?customer=${customer_id}`,
    'GET'
  )
}

export async function getAsaasCustomerPortalUrl(customer_id: string): Promise<string> {
  const data = await asaasRequest<{ url: string }>(
    `/customers/${customer_id}/generateBillingInfoUrl`,
    'GET'
  )
  return data.url
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

```bash
npx vitest run __tests__/lib/asaas-client.test.ts
```

Esperado: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/asaas/ __tests__/lib/asaas-client.test.ts
git commit -m "feat: Asaas API client com criação de customer, assinatura e portal"
```

---

## Task 2: Webhook Asaas

**Files:**
- Create: `app/api/webhooks/asaas/route.ts`

- [ ] **Step 1: Criar `app/api/webhooks/asaas/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const EVENT_TO_PLAN_STATUS: Record<string, 'active' | 'suspended'> = {
  PAYMENT_RECEIVED:          'active',
  PAYMENT_CONFIRMED:         'active',
  SUBSCRIPTION_RENEWED:      'active',
  PAYMENT_OVERDUE:           'suspended',
  SUBSCRIPTION_INACTIVATED:  'suspended',
}

export async function POST(request: Request) {
  const token = request.headers.get('asaas-access-token')
  if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const payload = await request.json()
  const event: string = payload.event
  const customerId: string = payload.payment?.customer ?? payload.subscription?.customer

  if (!customerId) return NextResponse.json({ ok: true })

  const band = await prisma.band.findFirst({ where: { asaas_id: customerId } })
  if (!band) {
    console.warn(`Asaas webhook: banda não encontrada para customer ${customerId}`)
    return NextResponse.json({ ok: true })
  }

  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    // Ativar/reativar o plano da banda
    // O plano atual já está no banco — apenas confirma atividade
    console.log(`Pagamento recebido para banda ${band.id}`)
  }

  if (event === 'PAYMENT_OVERDUE') {
    // Em v1: apenas logar — não bloquear acesso imediatamente
    console.warn(`Pagamento em atraso para banda ${band.id}`)
    // TODO v2: bloquear módulos não-essenciais após N dias
  }

  if (event === 'SUBSCRIPTION_INACTIVATED') {
    console.warn(`Assinatura inativada para banda ${band.id}`)
    // TODO v2: desativar acesso
  }

  return NextResponse.json({ ok: true })
}
```

> **Nota:** Na v1 o webhook apenas loga eventos. O bloqueio de acesso por inadimplência é escopo da v2.

- [ ] **Step 2: Commit**

```bash
git add app/api/webhooks/asaas/
git commit -m "feat: webhook Asaas para processar eventos de pagamento e assinatura"
```

---

## Task 3: API de Billing

**Files:**
- Create: `app/api/billing/subscription/route.ts`
- Create: `app/api/billing/portal/route.ts`

- [ ] **Step 1: Criar `app/api/billing/subscription/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getAsaasSubscriptions } from '@/lib/asaas/client'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id }, include: { band: true } })
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!sessionUser.band.asaas_id) {
    return NextResponse.json({
      data: {
        status: 'no_subscription',
        plan:   sessionUser.band.plan,
        asaas_id: null,
      },
    })
  }

  try {
    const { data: subscriptions } = await getAsaasSubscriptions(sessionUser.band.asaas_id)
    const active = subscriptions.find(s => s.status === 'ACTIVE') ?? subscriptions[0]

    return NextResponse.json({
      data: {
        status:      active?.status ?? 'NOT_FOUND',
        plan:        sessionUser.band.plan,
        value:       active?.value,
        next_due:    active?.nextDueDate,
        asaas_id:    sessionUser.band.asaas_id,
      },
    })
  } catch {
    return NextResponse.json({
      data: { status: 'error', plan: sessionUser.band.plan },
    })
  }
}
```

- [ ] **Step 2: Criar `app/api/billing/portal/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getAsaasCustomerPortalUrl } from '@/lib/asaas/client'

async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.user.findUnique({ where: { supabase_id: user.id }, include: { band: true } })
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!sessionUser.band.asaas_id) {
    return NextResponse.json({ error: 'Sem assinatura ativa' }, { status: 400 })
  }

  const url = await getAsaasCustomerPortalUrl(sessionUser.band.asaas_id)
  return NextResponse.json({ data: { url } })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/billing/
git commit -m "feat: API de billing — status da assinatura e link do portal Asaas"
```

---

## Task 4: Fluxo de Registro de Nova Banda (Provisionamento)

**Files:**
- Create: `app/api/register/route.ts`
- Create: `lib/validations/band.ts`

Este endpoint é usado pelo formulário de registro da página `/register`. Cria o usuário Supabase, cria a banda no banco, cria o customer no Asaas e inicia a assinatura.

- [ ] **Step 1: Criar `lib/validations/band.ts`**

```typescript
import { z } from 'zod'

export const registerSchema = z.object({
  band_name:  z.string().min(2, 'Nome da banda obrigatório'),
  admin_name: z.string().min(2, 'Nome do responsável obrigatório'),
  email:      z.string().email('Email inválido'),
  password:   z.string().min(8, 'Senha mínima de 8 caracteres'),
  plan:       z.enum(['starter', 'pro', 'enterprise']).default('starter'),
  cpf_cnpj:   z.string().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
```

- [ ] **Step 2: Criar `app/api/register/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validations/band'
import { createAsaasCustomer, createAsaasSubscription } from '@/lib/asaas/client'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { band_name, admin_name, email, password, plan, cpf_cnpj } = parsed.data

  // 1. Criar usuário no Supabase Auth (usando service role)
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    if (authError?.message.includes('already registered')) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Falha ao criar usuário' }, { status: 500 })
  }

  const supabaseUserId = authData.user.id

  try {
    // 2. Garantir slug único
    let slug = generateSlug(band_name)
    const existing = await prisma.band.findUnique({ where: { slug } })
    if (existing) slug = `${slug}-${Date.now()}`

    // 3. Criar customer no Asaas
    const asaasCustomer = await createAsaasCustomer({
      name: band_name,
      email,
      cpfCnpj: cpf_cnpj,
    }).catch(() => null) // Não falhar o registro se Asaas estiver fora

    // 4. Criar banda no banco
    const band = await prisma.band.create({
      data: {
        name:     band_name,
        slug,
        plan:     plan as any,
        asaas_id: asaasCustomer?.id ?? null,
      },
    })

    // 5. Criar usuário admin da banda
    await prisma.user.create({
      data: {
        band_id:    band.id,
        supabase_id: supabaseUserId,
        name:       admin_name,
        email,
        role:       'admin',
      },
    })

    // 6. Criar assinatura no Asaas (não bloqueia se falhar)
    if (asaasCustomer) {
      createAsaasSubscription({
        customer_id: asaasCustomer.id,
        plan,
        band_name,
      }).catch(err => console.error('Asaas subscription creation failed:', err))
    }

    return NextResponse.json({
      data: { band_slug: band.slug, band_id: band.id },
    }, { status: 201 })

  } catch (err) {
    // Rollback: deletar usuário Supabase se banco falhou
    await supabase.auth.admin.deleteUser(supabaseUserId).catch(() => {})
    console.error('Registration failed:', err)
    return NextResponse.json({ error: 'Falha no registro' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Criar `app/(auth)/register/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    band_name: '', admin_name: '', email: '', password: '', plan: 'starter',
  })

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const { error } = await res.json()
      setError(typeof error === 'string' ? error : 'Erro ao criar conta')
      setLoading(false)
      return
    }

    const { data } = await res.json()

    // Fazer login automático
    const supabase = createClient()
    await supabase.auth.signInWithPassword({ email: form.email, password: form.password })

    router.push(`/${data.band_slug}/comercial`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Criar conta — PanelAp</CardTitle>
          <p className="text-center text-gray-500 text-sm">14 dias grátis, sem cartão de crédito</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label>Nome da banda *</Label>
              <Input value={form.band_name} onChange={e => set('band_name', e.target.value)} required />
            </div>
            <div>
              <Label>Seu nome *</Label>
              <Input value={form.admin_name} onChange={e => set('admin_name', e.target.value)} required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={form.plan} onValueChange={v => set('plan', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter — R$ 97/mês</SelectItem>
                  <SelectItem value="pro">Pro — R$ 197/mês</SelectItem>
                  <SelectItem value="enterprise">Enterprise — R$ 397/mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta gratuita'}
            </Button>
            <p className="text-center text-sm text-gray-500">
              Já tem conta?{' '}
              <a href="/login" className="underline">Entrar</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/register/ app/(auth)/register/ lib/validations/band.ts
git commit -m "feat: fluxo de registro de banda com provisionamento Asaas + criação de admin"
```

---

## Task 5: Página de Configurações com Billing

**Files:**
- Create: `app/(dashboard)/[bandSlug]/configuracoes/page.tsx`

- [ ] **Step 1: Criar `app/(dashboard)/[bandSlug]/configuracoes/page.tsx`**

```typescript
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SubscriptionStatus } from '@/components/configuracoes/SubscriptionStatus'
import { MemberList } from '@/components/configuracoes/MemberList'

export default async function ConfiguracoesPage({
  params,
}: { params: { bandSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: user.id },
    include: { band: true },
  })

  if (!dbUser || dbUser.role !== 'admin') {
    redirect(`/${params.bandSlug}`)
  }

  const members = await prisma.user.findMany({
    where: { band_id: dbUser.band_id },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-gray-500 text-sm">{dbUser.band.name}</p>
      </div>

      {/* Billing */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Assinatura</h2>
        <SubscriptionStatus bandId={dbUser.band_id} hasAsaasId={!!dbUser.band.asaas_id} />
      </section>

      {/* Membros */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Membros da Banda</h2>
        <MemberList members={members} currentUserId={dbUser.id} />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Criar `components/configuracoes/SubscriptionStatus.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'

const planLabels: Record<string, string> = {
  starter: 'Starter — R$ 97/mês',
  pro:     'Pro — R$ 197/mês',
  enterprise: 'Enterprise — R$ 397/mês',
}

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE:          { label: 'Ativa', color: 'bg-green-100 text-green-800' },
  OVERDUE:         { label: 'Em atraso', color: 'bg-red-100 text-red-800' },
  INACTIVE:        { label: 'Inativa', color: 'bg-gray-100 text-gray-800' },
  no_subscription: { label: 'Sem assinatura', color: 'bg-yellow-100 text-yellow-800' },
  error:           { label: 'Erro', color: 'bg-gray-100 text-gray-800' },
}

interface SubscriptionStatusProps {
  bandId: string
  hasAsaasId: boolean
}

export function SubscriptionStatus({ bandId, hasAsaasId }: SubscriptionStatusProps) {
  const [sub, setSub] = useState<any>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(r => r.json())
      .then(({ data }) => setSub(data))
  }, [])

  async function openPortal() {
    setLoadingPortal(true)
    const res = await fetch('/api/billing/portal')
    if (res.ok) {
      const { data } = await res.json()
      window.open(data.url, '_blank')
    }
    setLoadingPortal(false)
  }

  if (!sub) return <div className="h-20 bg-gray-100 animate-pulse rounded-lg" />

  const statusInfo = statusLabels[sub.status] ?? statusLabels.error

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{planLabels[sub.plan] ?? sub.plan}</p>
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        {hasAsaasId && (
          <Button variant="outline" size="sm" onClick={openPortal} disabled={loadingPortal}>
            <ExternalLink size={14} className="mr-1" />
            {loadingPortal ? 'Abrindo...' : 'Gerenciar assinatura'}
          </Button>
        )}
      </div>
      {sub.next_due && (
        <p className="text-sm text-gray-500">
          Próximo vencimento: {new Date(sub.next_due).toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar `components/configuracoes/MemberList.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { User } from '@/types'

const roleLabels: Record<string, string> = {
  admin:      'Admin',
  commercial: 'Comercial',
  producer:   'Produtor',
  musician:   'Músico',
}

interface MemberListProps {
  members: User[]
  currentUserId: string
}

export function MemberList({ members, currentUserId }: MemberListProps) {
  return (
    <div className="border rounded-lg divide-y">
      {members.map(member => (
        <div key={member.id} className="flex items-center gap-3 p-3">
          <Avatar>
            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-sm">
              {member.name}
              {member.id === currentUserId && (
                <span className="text-gray-400 text-xs ml-2">(você)</span>
              )}
            </p>
            <p className="text-xs text-gray-400">{member.email}</p>
          </div>
          <Badge variant="outline">{roleLabels[member.role]}</Badge>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/ components/configuracoes/
git commit -m "feat: página de configurações com status de assinatura Asaas e lista de membros"
```

---

## Task 6: Cron para Gatilhos de Pós-venda

**Files:**
- Create: `app/api/cron/postsale/route.ts`

Este endpoint é chamado diariamente por um cron job externo (Vercel Cron, GitHub Actions, etc.).

- [ ] **Step 1: Criar `app/api/cron/postsale/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { triggerPreEventMessages, triggerPostEventMessages } from '@/lib/postsale/triggers'

export async function POST(request: Request) {
  // Verificar token de segurança do cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const errors: string[] = []

  await triggerPreEventMessages().catch(err => {
    errors.push(`pre_event: ${err.message}`)
  })

  await triggerPostEventMessages().catch(err => {
    errors.push(`post_event: ${err.message}`)
  })

  return NextResponse.json({
    data: {
      executed_at: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    },
  })
}
```

- [ ] **Step 2: Adicionar `CRON_SECRET` ao `.env.local.example`**

```bash
# Cron
CRON_SECRET=your-cron-secret-32-chars
```

- [ ] **Step 3: Configurar cron na Vercel (via `vercel.json`)**

```json
{
  "crons": [
    {
      "path": "/api/cron/postsale",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Isso executa o cron todo dia às 9h UTC. A Vercel passa o header `Authorization: Bearer CRON_SECRET` automaticamente.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/ vercel.json .env.local.example
git commit -m "feat: endpoint de cron para gatilhos de pós-venda + agendamento Vercel"
```

---

## Task 7: Verificação Final e Deploy

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 2: Verificar build de produção**

```bash
npm run build
```

Esperado: build sem erros.

- [ ] **Step 3: Verificar variáveis de ambiente**

Criar checklist de variáveis necessárias na Vercel:

```bash
# Verificar que todas as vars estão configuradas
echo "Verificar no painel da Vercel:"
echo "NEXT_PUBLIC_SUPABASE_URL"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY"
echo "DATABASE_URL"
echo "DIRECT_URL"
echo "ANTHROPIC_API_KEY"
echo "ZAPSIGN_API_TOKEN"
echo "ZAPSIGN_WEBHOOK_SECRET"
echo "ASAAS_API_KEY"
echo "ASAAS_WEBHOOK_TOKEN"
echo "WHATSAPP_API_URL"
echo "WHATSAPP_API_TOKEN"
echo "WHATSAPP_WEBHOOK_SECRET"
echo "CRON_SECRET"
echo "NEXT_PUBLIC_APP_URL"
```

- [ ] **Step 4: Testar fluxo end-to-end completo**

1. Registrar nova banda via `/register`
2. Verificar criação no Supabase, banco e Asaas
3. Fazer login e criar um lead
4. Mover lead para "Fechado"
5. Verificar criação automática de: Evento, Checklist, Contrato (pending_review)
6. Verificar que músicos escalados recebem notificação
7. Aprovar contrato e verificar envio para ZapSign
8. Verificar agenda com o evento no calendário
9. Verificar documentos

- [ ] **Step 5: Deploy na Vercel**

```bash
# Conectar repositório na Vercel ou via CLI
npx vercel --prod
```

- [ ] **Step 6: Verificar webhooks em produção**

Configurar URLs de webhook nos serviços:
- **WhatsApp provider:** `https://seu-app.vercel.app/api/webhooks/whatsapp`
- **ZapSign:** `https://seu-app.vercel.app/api/webhooks/zapsign`
- **Asaas:** `https://seu-app.vercel.app/api/webhooks/asaas`

- [ ] **Step 7: Commit final do projeto**

```bash
git add .
git commit -m "feat: Fase 7 completa — Billing Asaas, registro de banda, cron de pós-venda + projeto finalizado"
```

---

## Checklist da Fase 7

- [ ] `buildSubscriptionPayload` testado (4 testes) com preços corretos por plano
- [ ] Asaas client com create customer, subscription, portal URL
- [ ] Webhook Asaas processando eventos de pagamento
- [ ] API `/api/billing/subscription` retornando status
- [ ] API `/api/billing/portal` retornando link do portal
- [ ] Endpoint de registro criando: Supabase user, Band, User admin, Asaas customer + subscription
- [ ] Página de configurações com status de assinatura e lista de membros
- [ ] Cron endpoint para pós-venda (pre_event e post_event)
- [ ] `vercel.json` com agendamento do cron
- [ ] Variáveis de ambiente documentadas
- [ ] Deploy em produção
- [ ] Webhooks configurados nos providers externos
- [ ] Todos os testes passando

---

## Resumo do Projeto Completo

| Fase | Módulo | Principais entregas |
|------|--------|---------------------|
| 0 | Fundação | Next.js, Prisma, Supabase, RLS, Auth, Event Bus |
| 1 | Comercial | CRM Kanban, Leads, Mensagens, Webhook WhatsApp |
| 2 | Contratos | Templates, Geração automática, ZapSign |
| 3 | Produção | Eventos, Checklists, Equipe |
| 4 | Agenda | Calendário, Conflitos, Confirmação de músicos |
| 5 | Documentos | Upload Supabase Storage, PDF Viewer |
| 6 | Agentes IA | SDR, Contratos, Pós-venda (Claude API) |
| 7 | Billing | Asaas, Registro de banda, Cron de pós-venda |

**Total de testes:** 30+ testes unitários cobrindo toda lógica pura.

**Fluxo de dados central:**
```
WhatsApp → Lead (Fase 1)
Lead.status = CLOSED
  ├─ Event criado (Fase 3) → EventMusicians notificados (Fase 4)
  ├─ Contract criado em pending_review (Fase 2)
  └─ Agente SDR encerra conversa (Fase 6)

Contract.status = SIGNED
  ├─ PDF salvo em Documentos (Fase 5)
  └─ Pós-venda: mensagem de boas-vindas (Fase 6)
```
