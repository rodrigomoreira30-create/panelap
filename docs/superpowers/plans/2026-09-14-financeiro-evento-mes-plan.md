# Financeiro por Evento + Consolidação Mensal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o evento a única fonte de verdade financeira do PanelAp, eliminando lançamentos avulsos na tela mensal e ligando os custos de cachê automaticamente à Formação.

**Architecture:** Evolução incremental do módulo `EventFinance`/`EventFinanceItem` já existente. Camada de cálculo pura em `lib/financas.ts`, um novo `lib/finance-service.ts` para operações de banco (get-or-create + sincronização com Formação), reuso das rotas de API já existentes com extensões pontuais, e uma nova aba "Financeiro" no evento que substitui o placeholder atual.

**Tech Stack:** Next.js App Router, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL/Supabase, Zod, Vitest, TanStack Query, Tailwind.

---

## Achado importante (não estava no spec original)

`Event.lead_id` é `String @unique` **obrigatório** — todo `Event` precisa de um `Lead` vinculado 1:1. Isso significa que **não é seguro criar "eventos retroativos" automaticamente** para `EventFinance` órfãos (exigiria também sintetizar um `Lead` fake, poluindo o funil comercial). O levantamento de 14/09/2026 confirmou **zero** órfãos hoje, então o Task 1 abaixo implementa a rede de segurança como uma checagem que **bloqueia a migração de schema com um relatório claro** caso apareçam órfãos, em vez de tentar corrigi-los sozinha. Se a checagem falhar durante a execução deste plano, pare e resolva manualmente antes de continuar para o Task 4.

---

## File Structure

**Criar:**
- `scripts/migrate-orphan-finance.ts` — checagem de segurança (Task 1)
- `__tests__/lib/financas.test.ts` (Task 3)
- `prisma/migrations/20260914220000_financeiro_evento_obrigatorio/migration.sql` — migração de schema (Task 4)
- `__tests__/api/financas.test.ts` (Task 5)
- `__tests__/api/financas-items.test.ts` (Task 6)
- `lib/finance-service.ts` — get-or-create de `EventFinance` + sincronização com Formação (server-only, usa Prisma) (Task 7)
- `app/api/events/[id]/finance/route.ts` — GET do financeiro de um evento específico (Task 8)
- `__tests__/api/event-finance.test.ts` (Task 8)
- `__tests__/api/event-musicians-finance-sync.test.ts` (Task 9)
- `components/producao/EventFinanceTab.tsx` — nova aba "Financeiro" do evento (Task 10)

**Modificar:**
- `package.json` — adiciona `tsx` como devDependency e o script `check:orphan-finance` (Task 1)
- `lib/financas.ts` — remove categorias de instrumento do `DEFAULT_FINANCE_ITEMS`, adiciona constantes e `computeEventFinance` (Task 2)
- `prisma/schema.prisma` — `EventFinanceItem` ganha `percent_of_revenue`/`is_overridden`/`event_musician_id`; `EventMusician` ganha relação inversa; `EventFinance.event_id` passa a obrigatório com `onDelete: Cascade` (Task 4)
- `app/api/financas/route.ts` — `POST` exige `event_id` (Task 5)
- `app/api/financas/[id]/items/[itemId]/route.ts` — suporte a `percent_of_revenue`/`is_overridden` (Task 6)
- `app/api/event-musicians/route.ts` — sincroniza custo de cachê no `POST`/`PATCH`/`DELETE` (Task 9)
- `components/producao/EventTabs.tsx` — troca o placeholder da aba Financeiro pelo `EventFinanceTab` (Task 10)
- `components/financas/FinanceTable.tsx` — vira somente-leitura, clique navega para o evento (Task 11)
- `components/financas/AddShowModal.tsx` e `components/financas/FinancasClient.tsx` — remove a aba "Entrada avulsa" (Task 12)

**Apagar:**
- `components/financas/FinanceCell.tsx` — fica sem nenhum uso depois que a tela mensal vira somente-leitura (Task 11)

Cada arquivo tem uma responsabilidade: `lib/financas.ts` fica 100% puro (sem I/O) para ser testável isoladamente; `lib/finance-service.ts` concentra tudo que fala com o Prisma para o financeiro fora das rotas HTTP, para não duplicar a lógica de get-or-create entre a rota do evento e a sincronização de músicos.

---

## Phase 1 — Rede de segurança de migração

### Task 1: Script de checagem de órfãos + baseline

**Files:**
- Modify: `package.json`
- Create: `scripts/migrate-orphan-finance.ts`

- [ ] **Step 1: Instalar `tsx` como devDependency**

Run: `npm install -D tsx`
Expected: `tsx` aparece em `devDependencies` no `package.json`.

- [ ] **Step 2: Adicionar o script no `package.json`**

Em `package.json`, dentro de `"scripts"`, adicionar:

```json
    "check:orphan-finance": "tsx scripts/migrate-orphan-finance.ts"
```

- [ ] **Step 3: Escrever o script**

Criar `scripts/migrate-orphan-finance.ts`:

```ts
import { prisma } from '../lib/prisma'

async function main() {
  const orphans = await prisma.eventFinance.findMany({
    where: { event_id: null },
    select: { id: true, name: true, client: true, event_date: true, expected_revenue: true },
    orderBy: { event_date: 'asc' },
  })

  if (orphans.length === 0) {
    console.log('OK: nenhum EventFinance sem evento vinculado. Seguro prosseguir com a migração de schema (event_id obrigatório).')
    return
  }

  console.error(
    `ATENÇÃO: ${orphans.length} registro(s) financeiro(s) sem evento vinculado encontrados.\n` +
    'Event.lead_id é obrigatório e único no schema atual — não é seguro criar eventos ' +
    'retroativos automaticamente (exigiria também criar Leads sintéticos no funil comercial).\n' +
    'Resolva manualmente (vincule a um evento existente ou decida descartar) antes de aplicar ' +
    'a migração que torna EventFinance.event_id obrigatório:'
  )
  for (const f of orphans) {
    const revenue = parseFloat(f.expected_revenue.toString())
    console.error(
      `  - ${f.id} | ${f.name} (${f.client ?? 'sem cliente'}) | ` +
      `${f.event_date.toISOString().slice(0, 10)} | R$ ${revenue.toFixed(2)}`
    )
  }
  process.exitCode = 1
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 4: Rodar contra o banco atual e confirmar o baseline**

Run: `npm run check:orphan-finance`
Expected: `OK: nenhum EventFinance sem evento vinculado. Seguro prosseguir com a migração de schema (event_id obrigatório).` e exit code `0`.

Se aparecer qualquer órfão aqui, **pare** — resolva manualmente (usando a UI de Finanças para vincular a um evento, ou apagando o registro se for lixo de teste) antes de ir para o Task 4.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts/migrate-orphan-finance.ts
git commit -m "chore: script de checagem de registros financeiros sem evento vinculado"
```

---

## Phase 2 — Camada de cálculo pura (antes do schema, para fixar os tipos)

### Task 2: Atualizar tipos e categorias em `lib/financas.ts`

**Files:**
- Modify: `lib/financas.ts`

- [ ] **Step 1: Atualizar o arquivo**

Substituir o conteúdo de `lib/financas.ts` por:

```ts
// lib/financas.ts

export type FinanceItemData = {
  id: string
  finance_id: string
  category: string
  label: string
  amount: number
  paid: boolean
  notes: string | null
  percent_of_revenue: number | null
  is_overridden: boolean
  event_musician_id: string | null
}

export type EventFinanceData = {
  id: string
  event_id: string | null
  name: string
  client: string | null
  product: string | null
  event_date: string
  expected_revenue: number
  received_amount: number
  notes: string | null
  items: FinanceItemData[]
}

export const CACHE_MUSICO_CATEGORY = 'cache_musico'

export const DEFAULT_FINANCE_ITEMS: { category: string; label: string }[] = [
  { category: 'pro_labore',        label: 'Pró-labore' },
  { category: 'comissao_panel',    label: 'Comissão Panel' },
  { category: 'comissao_vendedor', label: 'Comissão vendedor' },
  { category: 'nota_fiscal',       label: 'Nota fiscal' },
  { category: 'visita_tecnica',    label: 'Visita técnica' },
  { category: 'bv_cerimonial',     label: 'BV cerimonial' },
  { category: 'alimentacao_extra', label: 'Alimentação extra' },
  { category: 'transporte',        label: 'Transporte' },
  { category: 'hospedagem',        label: 'Hospedagem' },
  { category: 'outros',            label: 'Outros custos' },
]

export const PERCENT_ELIGIBLE_CATEGORIES = new Set([
  'comissao_panel',
  'comissao_vendedor',
  'nota_fiscal',
])

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function serializeFinance(f: any): EventFinanceData {
  return {
    id:               f.id,
    event_id:         f.event_id ?? null,
    name:             f.name,
    client:           f.client ?? null,
    product:          f.product ?? null,
    event_date:       f.event_date instanceof Date ? f.event_date.toISOString() : f.event_date,
    expected_revenue: parseFloat(f.expected_revenue.toString()),
    received_amount:  parseFloat(f.received_amount.toString()),
    notes:            f.notes ?? null,
    items: (f.items ?? []).map((i: any) => ({
      id:                 i.id,
      finance_id:         i.finance_id,
      category:           i.category,
      label:              i.label,
      amount:             parseFloat(i.amount.toString()),
      paid:               i.paid,
      notes:              i.notes ?? null,
      percent_of_revenue: i.percent_of_revenue !== null && i.percent_of_revenue !== undefined
        ? parseFloat(i.percent_of_revenue.toString())
        : null,
      is_overridden:      i.is_overridden ?? false,
      event_musician_id:  i.event_musician_id ?? null,
    })),
  }
}

export function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function calcTotals(finances: EventFinanceData[]) {
  const totalRevenue   = finances.reduce((s, f) => s + f.expected_revenue, 0)
  const totalReceived  = finances.reduce((s, f) => s + f.received_amount, 0)
  const totalToReceive = totalRevenue - totalReceived
  const totalCosts     = finances.reduce(
    (s, f) => s + computeEventFinance(f).costTotal, 0
  )
  const totalProfit    = totalRevenue - totalCosts
  const margin         = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  return { totalRevenue, totalReceived, totalToReceive, totalCosts, totalProfit, margin }
}

/** Valor "vivo" de um item: se tem percentual e não foi sobrescrito manualmente, é
 * sempre recalculado a partir da receita prevista; senão, usa o valor gravado. */
export function resolveItemAmount(item: FinanceItemData, revenueForecast: number): number {
  if (item.percent_of_revenue !== null && !item.is_overridden) {
    return round2((revenueForecast * item.percent_of_revenue) / 100)
  }
  return item.amount
}

export type EventFinanceTotals = {
  revenueForecast: number
  received: number
  receivable: number
  costTotal: number
  costByCategory: Record<string, number>
  profit: number
  marginPercent: number | null
  cashProfit: number
}

export function computeEventFinance(finance: EventFinanceData): EventFinanceTotals {
  const revenueForecast = finance.expected_revenue
  const received        = finance.received_amount
  const receivable       = round2(revenueForecast - received)

  const costByCategory: Record<string, number> = {}
  let costTotal = 0
  let paidCostTotal = 0

  for (const item of finance.items) {
    const amount = resolveItemAmount(item, revenueForecast)
    costByCategory[item.category] = round2((costByCategory[item.category] ?? 0) + amount)
    costTotal += amount
    if (item.paid) paidCostTotal += amount
  }
  costTotal = round2(costTotal)
  paidCostTotal = round2(paidCostTotal)

  const profit = round2(revenueForecast - costTotal)
  const marginPercent = revenueForecast === 0 ? null : round2((profit / revenueForecast) * 100)
  const cashProfit = round2(received - paidCostTotal)

  return { revenueForecast, received, receivable, costTotal, costByCategory, profit, marginPercent, cashProfit }
}
```

Mudanças em relação ao arquivo atual: `DEFAULT_FINANCE_ITEMS` perdeu as categorias de instrumento (`cantor_1..4`, `guitarrista`, `baixista`, `baterista`, `tecladista`, `percussao`, `sanfoneiro`, `dj`, `tecnico_som`, `tecnico_luz`); `FinanceItemData` ganhou `percent_of_revenue`/`is_overridden`/`event_musician_id`; `calcTotals` agora soma custos via `computeEventFinance` (que já trata itens percentuais) em vez de somar `item.amount` cru; e `computeEventFinance`/`resolveItemAmount`/`round2`/`CACHE_MUSICO_CATEGORY`/`PERCENT_ELIGIBLE_CATEGORIES` são novos.

- [ ] **Step 2: Checar tipos (smoke check antes de mexer no schema)**

Run: `npx tsc --noEmit`
Expected: sem novos erros de tipo além dos que já existiam (rode `git stash && npx tsc --noEmit` antes se quiser comparar a baseline). Os campos novos (`percent_of_revenue`, `is_overridden`, `event_musician_id`) só existem no tipo `FinanceItemData` a partir deste commit — o Prisma Client ainda não os tem até o Task 4 rodar a migração, então qualquer código que já leia esses campos de dados vindos do Prisma (nenhum até aqui) só compilará depois do Task 4.

- [ ] **Step 3: Commit**

```bash
git add lib/financas.ts
git commit -m "feat(financas): computeEventFinance puro + remove categorias fixas de instrumento"
```

### Task 3: Testes unitários de `computeEventFinance`

**Files:**
- Create: `__tests__/lib/financas.test.ts`

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, it, expect } from 'vitest'
import { computeEventFinance, resolveItemAmount, type EventFinanceData, type FinanceItemData } from '@/lib/financas'

function item(overrides: Partial<FinanceItemData> = {}): FinanceItemData {
  return {
    id: 'item-1',
    finance_id: 'finance-1',
    category: 'outros',
    label: 'Item',
    amount: 0,
    paid: false,
    notes: null,
    percent_of_revenue: null,
    is_overridden: false,
    event_musician_id: null,
    ...overrides,
  }
}

function finance(overrides: Partial<EventFinanceData> = {}): EventFinanceData {
  return {
    id: 'finance-1',
    event_id: 'event-1',
    name: 'Show teste',
    client: null,
    product: null,
    event_date: '2026-09-14T00:00:00.000Z',
    expected_revenue: 0,
    received_amount: 0,
    notes: null,
    items: [],
    ...overrides,
  }
}

describe('computeEventFinance', () => {
  it('evento sem nada: tudo zero e margem exibida como null (para virar "—" na UI)', () => {
    const totals = computeEventFinance(finance())
    expect(totals.revenueForecast).toBe(0)
    expect(totals.costTotal).toBe(0)
    expect(totals.profit).toBe(0)
    expect(totals.marginPercent).toBeNull()
  })

  it('evento só com receita: lucro igual à receita, margem 100%', () => {
    const totals = computeEventFinance(finance({ expected_revenue: 1000 }))
    expect(totals.profit).toBe(1000)
    expect(totals.marginPercent).toBe(100)
  })

  it('item percentual sem override recalcula a partir da receita prevista', () => {
    const f = finance({
      expected_revenue: 1000,
      items: [item({ category: 'comissao_panel', percent_of_revenue: 10, amount: 999 })],
    })
    const totals = computeEventFinance(f)
    expect(totals.costByCategory.comissao_panel).toBe(100)
    expect(totals.costTotal).toBe(100)
  })

  it('item percentual com override usa o valor gravado manualmente', () => {
    const f = finance({
      expected_revenue: 1000,
      items: [item({ category: 'comissao_panel', percent_of_revenue: 10, amount: 250, is_overridden: true })],
    })
    const totals = computeEventFinance(f)
    expect(totals.costByCategory.comissao_panel).toBe(250)
  })

  it('lucro negativo aparece com sinal', () => {
    const f = finance({
      expected_revenue: 500,
      items: [item({ amount: 800 })],
    })
    const totals = computeEventFinance(f)
    expect(totals.profit).toBe(-300)
    expect(totals.marginPercent).toBe(-60)
  })

  it('recebido acima do previsto deixa "a receber" negativo, sem travar', () => {
    const f = finance({ expected_revenue: 1000, received_amount: 1200 })
    const totals = computeEventFinance(f)
    expect(totals.receivable).toBe(-200)
  })

  it('visão de caixa considera só os custos pagos', () => {
    const f = finance({
      expected_revenue: 1000,
      received_amount: 1000,
      items: [
        item({ id: 'a', amount: 100, paid: true }),
        item({ id: 'b', amount: 300, paid: false }),
      ],
    })
    const totals = computeEventFinance(f)
    expect(totals.cashProfit).toBe(900) // 1000 recebido - 100 pago
    expect(totals.costTotal).toBe(400)  // 100 + 300 previstos
  })

  it('arredonda para 2 casas decimais em percentuais com dízima', () => {
    const f = finance({
      expected_revenue: 100,
      items: [item({ percent_of_revenue: 33.333, amount: 0 })],
    })
    const totals = computeEventFinance(f)
    expect(totals.costTotal).toBe(33.33)
  })
})

describe('resolveItemAmount', () => {
  it('sem percentual, retorna o amount gravado', () => {
    expect(resolveItemAmount(item({ amount: 42 }), 1000)).toBe(42)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que passam**

Run: `npx vitest run __tests__/lib/financas.test.ts`
Expected: `8 passed` (ou número equivalente de `it` acima), 0 falhas.

- [ ] **Step 3: Commit**

```bash
git add __tests__/lib/financas.test.ts
git commit -m "test(financas): cobertura de computeEventFinance para casos de borda"
```

---

## Phase 3 — Schema

### Task 4: Alterar `prisma/schema.prisma`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Atualizar `EventFinance`**

Em `prisma/schema.prisma`, no model `EventFinance` (linhas ~318-337), trocar:

```prisma
model EventFinance {
  id               String   @id @default(cuid())
  band_id          String
  event_id         String?  @unique
  name             String
  client           String?
  product          String?
  event_date       DateTime
  expected_revenue Decimal  @default(0)
  received_amount  Decimal  @default(0)
  notes            String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  band  Band              @relation(fields: [band_id], references: [id], onDelete: Cascade)
  event Event?            @relation(fields: [event_id], references: [id], onDelete: SetNull)
  items EventFinanceItem[]

  @@index([band_id, event_date])
}
```

por:

```prisma
model EventFinance {
  id               String   @id @default(cuid())
  band_id          String
  event_id         String   @unique
  name             String
  client           String?
  product          String?
  event_date       DateTime
  expected_revenue Decimal  @default(0)
  received_amount  Decimal  @default(0)
  notes            String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  band  Band              @relation(fields: [band_id], references: [id], onDelete: Cascade)
  event Event             @relation(fields: [event_id], references: [id], onDelete: Cascade)
  items EventFinanceItem[]

  @@index([band_id, event_date])
}
```

- [ ] **Step 2: Atualizar `EventFinanceItem`**

Trocar:

```prisma
model EventFinanceItem {
  id         String   @id @default(cuid())
  finance_id String
  category   String
  label      String
  amount     Decimal  @default(0)
  paid       Boolean  @default(false)
  notes      String?
  created_at DateTime @default(now())

  finance EventFinance @relation(fields: [finance_id], references: [id], onDelete: Cascade)

  @@index([finance_id])
}
```

por:

```prisma
model EventFinanceItem {
  id                 String   @id @default(cuid())
  finance_id         String
  category           String
  label              String
  amount             Decimal  @default(0)
  paid               Boolean  @default(false)
  notes              String?
  percent_of_revenue Decimal? @db.Decimal(5, 2)
  is_overridden      Boolean  @default(false)
  event_musician_id  String?
  created_at         DateTime @default(now())

  finance        EventFinance   @relation(fields: [finance_id], references: [id], onDelete: Cascade)
  event_musician EventMusician? @relation(fields: [event_musician_id], references: [id], onDelete: SetNull)

  @@index([finance_id])
  @@index([event_musician_id])
}
```

- [ ] **Step 3: Adicionar a relação inversa em `EventMusician`**

No model `EventMusician` (linhas ~235-248), trocar:

```prisma
model EventMusician {
  id           String                @id @default(cuid())
  event_id     String
  user_id      String?
  instrument   String?
  status       MusicianConfirmStatus @default(pending)
  confirmed_at DateTime?
  cache_value  Decimal?

  event Event  @relation(fields: [event_id], references: [id], onDelete: Cascade)
  user  User?  @relation(fields: [user_id], references: [id], onDelete: SetNull)

  @@index([event_id])
}
```

por:

```prisma
model EventMusician {
  id           String                @id @default(cuid())
  event_id     String
  user_id      String?
  instrument   String?
  status       MusicianConfirmStatus @default(pending)
  confirmed_at DateTime?
  cache_value  Decimal?

  event         Event              @relation(fields: [event_id], references: [id], onDelete: Cascade)
  user          User?              @relation(fields: [user_id], references: [id], onDelete: SetNull)
  finance_items EventFinanceItem[]

  @@index([event_id])
}
```

- [ ] **Step 4: Escrever a migração SQL**

Criar a pasta `prisma/migrations/20260914220000_financeiro_evento_obrigatorio/` com o arquivo `migration.sql`:

```sql
-- AlterTable: EventFinanceItem ganha % automático, override e vínculo com músico
ALTER TABLE "EventFinanceItem" ADD COLUMN "percent_of_revenue" DECIMAL(5,2);
ALTER TABLE "EventFinanceItem" ADD COLUMN "is_overridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventFinanceItem" ADD COLUMN "event_musician_id" TEXT;

-- CreateIndex
CREATE INDEX "EventFinanceItem_event_musician_id_idx" ON "EventFinanceItem"("event_musician_id");

-- AddForeignKey
ALTER TABLE "EventFinanceItem" ADD CONSTRAINT "EventFinanceItem_event_musician_id_fkey" FOREIGN KEY ("event_musician_id") REFERENCES "EventMusician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: EventFinance.event_id passa a ser obrigatório
-- (pré-requisito: `npm run check:orphan-finance` precisa reportar zero órfãos antes de rodar isto em produção)
ALTER TABLE "EventFinance" ALTER COLUMN "event_id" SET NOT NULL;

-- DropForeignKey (SetNull antigo)
ALTER TABLE "EventFinance" DROP CONSTRAINT "EventFinance_event_id_fkey";

-- AddForeignKey (Cascade)
ALTER TABLE "EventFinance" ADD CONSTRAINT "EventFinance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Rodar a checagem de órfãos de novo (revalidar o baseline antes de tocar produção)**

Run: `npm run check:orphan-finance`
Expected: `OK: nenhum EventFinance sem evento vinculado...`. **Se isso não passar, pare e não continue para o próximo step.**

- [ ] **Step 6: Aplicar a migração e regenerar o client**

Esta etapa altera o schema do banco de produção — confirme com o usuário antes de rodar fora de um ambiente de teste.

Run: `npx prisma migrate deploy`
Expected: `Applying migration \`20260914220000_financeiro_evento_obrigatorio\`` seguido de `All migrations have been successfully applied.`

Run: `npx prisma generate`
Expected: `Generated Prisma Client (7.8.0) to ./lib/generated/prisma`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260914220000_financeiro_evento_obrigatorio
git commit -m "feat(schema): EventFinance.event_id obrigatorio + custos percentuais/vinculados a musico"
```

---

## Phase 4 — API

### Task 5: `POST /api/financas` passa a exigir `event_id`

**Files:**
- Modify: `app/api/financas/route.ts`
- Create: `__tests__/api/financas.test.ts`

- [ ] **Step 1: Escrever o teste (vai falhar contra a implementação atual)**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/financas/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findFirst: vi.fn() },
    eventFinance: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/financas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/financas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 422 quando event_id não é enviado', async () => {
    const response = await POST(makeRequest({ name: 'Show avulso' }))
    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.error).toMatch(/event_id/)
  })

  it('cria o financeiro vinculado a um evento existente', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({
      id: 'event-1',
      band_id: 'band-1',
      client_name: 'Casamento Ana',
      event_date: new Date('2026-10-01'),
      lead: { lead_attractions: [], proposal_discount: 0 },
    } as any)
    vi.mocked(prisma.eventFinance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.eventFinance.create).mockResolvedValueOnce({
      id: 'finance-1',
      event_id: 'event-1',
      name: 'Casamento Ana',
      client: 'Casamento Ana',
      product: null,
      event_date: new Date('2026-10-01'),
      expected_revenue: 0,
      received_amount: 0,
      notes: null,
      items: [],
    } as any)

    const response = await POST(makeRequest({ event_id: 'event-1' }))
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.data.event_id).toBe('event-1')
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha esperada**

Run: `npx vitest run __tests__/api/financas.test.ts`
Expected: FAIL no primeiro teste (`422` esperado, mas a rota atual aceita entrada avulsa).

- [ ] **Step 3: Atualizar a rota**

Em `app/api/financas/route.ts`, substituir a função `POST` inteira por:

```ts
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { event_id, product } = body

  if (!event_id) {
    return NextResponse.json(
      { error: 'event_id obrigatório — todo registro financeiro precisa estar vinculado a um evento' },
      { status: 422 }
    )
  }

  const event = await prisma.event.findFirst({
    where: { id: event_id, band_id: sessionUser.band_id },
    include: { lead: { include: { lead_attractions: true } } },
  })
  if (!event) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const existingFinance = await prisma.eventFinance.findUnique({ where: { event_id } })
  if (existingFinance) return NextResponse.json({ error: 'Evento já possui registro financeiro' }, { status: 409 })

  const attractionsTotal = (event.lead?.lead_attractions ?? []).reduce(
    (s, a) => s + parseFloat(a.custom_value.toString()), 0
  )
  const discount = parseFloat((event.lead?.proposal_discount ?? 0).toString())
  const finalRevenue = Math.max(0, attractionsTotal - discount)

  const finance = await prisma.eventFinance.create({
    data: {
      band_id:          sessionUser.band_id,
      event_id,
      name:             event.client_name,
      client:           event.client_name,
      product:          product ?? null,
      event_date:       event.event_date,
      expected_revenue: finalRevenue,
      received_amount:  0,
      items: {
        createMany: {
          data: DEFAULT_FINANCE_ITEMS.map(item => ({
            category: item.category,
            label:    item.label,
            amount:   0,
            paid:     false,
          })),
        },
      },
    },
    include: { items: { orderBy: { created_at: 'asc' } } },
  })

  return NextResponse.json({ data: serializeFinance(finance) }, { status: 201 })
}
```

O `GET` do mesmo arquivo não muda.

- [ ] **Step 4: Rodar os testes de novo**

Run: `npx vitest run __tests__/api/financas.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/api/financas/route.ts __tests__/api/financas.test.ts
git commit -m "feat(api): POST /api/financas exige event_id, remove entrada avulsa"
```

### Task 6: `PATCH /api/financas/[id]/items/[itemId]` — suporte a percentual/override

**Files:**
- Modify: `app/api/financas/[id]/items/[itemId]/route.ts`
- Create: `__tests__/api/financas-items.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PATCH } from '@/app/api/financas/[id]/items/[itemId]/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    eventFinanceItem: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/financas/finance-1/items/item-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'finance-1', itemId: 'item-1' })

describe('PATCH /api/financas/[id]/items/[itemId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('definir percent_of_revenue recalcula amount e desliga o override', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinanceItem.findUnique).mockResolvedValueOnce({
      id: 'item-1',
      finance_id: 'finance-1',
      amount: { toString: () => '0' },
      percent_of_revenue: null,
      finance: { band_id: 'band-1', expected_revenue: { toString: () => '1000' } },
    } as any)
    vi.mocked(prisma.eventFinanceItem.update).mockImplementationOnce(async ({ data }: any) => ({
      id: 'item-1',
      amount: { toString: () => String(data.amount) },
      percent_of_revenue: { toString: () => String(data.percent_of_revenue) },
      is_overridden: data.is_overridden,
    } as any))

    const response = await PATCH(makeRequest({ percent_of_revenue: 10 }), { params })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.amount).toBe(100)
    expect(json.data.is_overridden).toBe(false)
  })

  it('editar amount manualmente com percentual já definido liga o override', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinanceItem.findUnique).mockResolvedValueOnce({
      id: 'item-1',
      finance_id: 'finance-1',
      amount: { toString: () => '100' },
      percent_of_revenue: { toString: () => '10' },
      finance: { band_id: 'band-1', expected_revenue: { toString: () => '1000' } },
    } as any)
    vi.mocked(prisma.eventFinanceItem.update).mockImplementationOnce(async ({ data }: any) => ({
      id: 'item-1',
      amount: { toString: () => String(data.amount) },
      percent_of_revenue: { toString: () => '10' },
      is_overridden: data.is_overridden,
    } as any))

    const response = await PATCH(makeRequest({ amount: 250 }), { params })
    const json = await response.json()
    expect(json.data.amount).toBe(250)
    expect(json.data.is_overridden).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run __tests__/api/financas-items.test.ts`
Expected: FAIL — a rota atual não tem essa lógica ainda.

- [ ] **Step 3: Atualizar a rota**

Em `app/api/financas/[id]/items/[itemId]/route.ts`, trocar a função `getItem` e o `PATCH` por:

```ts
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { round2 } from '@/lib/financas'

async function getItem(
  sessionUser: { band_id: string },
  financeId: string,
  itemId: string
) {
  const item = await prisma.eventFinanceItem.findUnique({
    where: { id: itemId },
    include: { finance: { select: { band_id: true, expected_revenue: true } } },
  })
  if (!item || item.finance_id !== financeId || item.finance.band_id !== sessionUser.band_id) {
    return null
  }
  return item
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, itemId } = await params
  const item = await getItem(sessionUser, id, itemId)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const revenue = parseFloat(item.finance.expected_revenue.toString())

  const data: Record<string, unknown> = {
    label: body.label !== undefined ? body.label : undefined,
    paid:  body.paid  !== undefined ? body.paid  : undefined,
    notes: body.notes !== undefined ? body.notes : undefined,
  }

  if (body.percent_of_revenue !== undefined) {
    data.percent_of_revenue = body.percent_of_revenue
    data.is_overridden = false
    data.amount = body.percent_of_revenue === null
      ? parseFloat(item.amount.toString())
      : round2((revenue * body.percent_of_revenue) / 100)
  } else if (body.amount !== undefined) {
    data.amount = body.amount
    if (item.percent_of_revenue !== null) data.is_overridden = true
  }

  const updated = await prisma.eventFinanceItem.update({
    where: { id: itemId },
    data,
  })

  return NextResponse.json({
    data: {
      ...updated,
      amount: parseFloat(updated.amount.toString()),
      percent_of_revenue: updated.percent_of_revenue !== null
        ? parseFloat(updated.percent_of_revenue.toString())
        : null,
    },
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, itemId } = await params
  const item = await getItem(sessionUser, id, itemId)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.eventFinanceItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Rodar os testes de novo**

Run: `npx vitest run __tests__/api/financas-items.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add "app/api/financas/[id]/items/[itemId]/route.ts" __tests__/api/financas-items.test.ts
git commit -m "feat(api): PATCH de item financeiro suporta percentual automatico com override"
```

### Task 7: `lib/finance-service.ts` — get-or-create + sincronização com Formação

**Files:**
- Create: `lib/finance-service.ts`

- [ ] **Step 1: Escrever o arquivo**

```ts
import { prisma } from '@/lib/prisma'
import { DEFAULT_FINANCE_ITEMS, CACHE_MUSICO_CATEGORY } from '@/lib/financas'

export async function getOrCreateEventFinance(eventId: string) {
  const existing = await prisma.eventFinance.findUnique({
    where: { event_id: eventId },
    include: { items: { orderBy: { created_at: 'asc' } } },
  })
  if (existing) return existing

  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })

  return prisma.eventFinance.create({
    data: {
      band_id:          event.band_id,
      event_id:         eventId,
      name:             event.client_name,
      client:           event.client_name,
      event_date:       event.event_date,
      expected_revenue: event.value,
      received_amount:  0,
      items: {
        createMany: {
          data: DEFAULT_FINANCE_ITEMS.map(item => ({
            category: item.category,
            label:    item.label,
            amount:   0,
            paid:     false,
          })),
        },
      },
    },
    include: { items: { orderBy: { created_at: 'asc' } } },
  })
}

function musicianLabel(instrument: string | null, userName: string | null): string {
  const base = instrument ?? 'Músico'
  return userName ? `${base} — ${userName}` : base
}

/** Cria/atualiza a linha de custo `cache_musico` vinculada a um EventMusician,
 *  ou a remove se o cachê foi zerado (e ainda não estiver paga). */
export async function syncMusicianCost(eventMusicianId: string): Promise<void> {
  const em = await prisma.eventMusician.findUniqueOrThrow({
    where: { id: eventMusicianId },
    include: {
      user: { select: { name: true } },
      event: { select: { id: true } },
    },
  })

  const existingItem = await prisma.eventFinanceItem.findFirst({
    where: { event_musician_id: eventMusicianId },
  })

  if (em.cache_value === null) {
    if (existingItem && !existingItem.paid) {
      await prisma.eventFinanceItem.delete({ where: { id: existingItem.id } })
    }
    return
  }

  const label = musicianLabel(em.instrument, em.user?.name ?? null)

  if (existingItem) {
    await prisma.eventFinanceItem.update({
      where: { id: existingItem.id },
      data: { label, amount: em.cache_value },
    })
    return
  }

  const finance = await getOrCreateEventFinance(em.event.id)
  await prisma.eventFinanceItem.create({
    data: {
      finance_id:         finance.id,
      category:           CACHE_MUSICO_CATEGORY,
      label,
      amount:             em.cache_value,
      paid:               false,
      event_musician_id:  eventMusicianId,
    },
  })
}

/** Remove a linha de custo vinculada a um músico. Retorna `blocked: true` sem
 *  apagar nada se a linha já estiver paga e `force` não for passado. */
export async function removeMusicianCost(
  eventMusicianId: string,
  force = false
): Promise<{ blocked: boolean }> {
  const item = await prisma.eventFinanceItem.findFirst({
    where: { event_musician_id: eventMusicianId },
  })
  if (!item) return { blocked: false }
  if (item.paid && !force) return { blocked: true }

  await prisma.eventFinanceItem.delete({ where: { id: item.id } })
  return { blocked: false }
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo relacionado a `lib/finance-service.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/finance-service.ts
git commit -m "feat(financas): finance-service com get-or-create e sincronizacao de cache de musico"
```

### Task 8: `GET /api/events/[id]/finance` — financeiro do evento (get-or-create)

**Files:**
- Create: `app/api/events/[id]/finance/route.ts`
- Create: `__tests__/api/event-finance.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/events/[id]/finance/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/finance-service', () => ({
  getOrCreateEventFinance: vi.fn(),
}))

const params = Promise.resolve({ id: 'event-1' })

describe('GET /api/events/[id]/finance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 404 quando o evento não pertence à banda', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce(null)

    const response = await GET(new Request('http://localhost/api/events/event-1/finance'), { params })
    expect(response.status).toBe(404)
  })

  it('retorna os dados serializados e os totais calculados', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getOrCreateEventFinance } = await import('@/lib/finance-service')

    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({ id: 'event-1', band_id: 'band-1' } as any)
    vi.mocked(getOrCreateEventFinance).mockResolvedValueOnce({
      id: 'finance-1',
      event_id: 'event-1',
      name: 'Show X',
      client: null,
      product: null,
      event_date: new Date('2026-10-01'),
      expected_revenue: { toString: () => '1000' },
      received_amount: { toString: () => '0' },
      notes: null,
      items: [],
    } as any)

    const response = await GET(new Request('http://localhost/api/events/event-1/finance'), { params })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.expected_revenue).toBe(1000)
    expect(json.totals.profit).toBe(1000)
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run __tests__/api/event-finance.test.ts`
Expected: FAIL — o arquivo da rota ainda não existe (`Cannot find module`).

- [ ] **Step 3: Escrever a rota**

Criar `app/api/events/[id]/finance/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { serializeFinance, computeEventFinance } from '@/lib/financas'
import { getOrCreateEventFinance } from '@/lib/finance-service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: eventId } = await params
  const event = await prisma.event.findFirst({
    where: { id: eventId, band_id: sessionUser.band_id },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const finance = await getOrCreateEventFinance(eventId)
  const data = serializeFinance(finance)

  return NextResponse.json({ data, totals: computeEventFinance(data) })
}
```

- [ ] **Step 4: Rodar os testes de novo**

Run: `npx vitest run __tests__/api/event-finance.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/api/events/[id]/finance/route.ts __tests__/api/event-finance.test.ts
git commit -m "feat(api): GET /api/events/[id]/finance com get-or-create"
```

### Task 9: Sincronizar cachê no `app/api/event-musicians/route.ts`

**Files:**
- Modify: `app/api/event-musicians/route.ts`
- Create: `__tests__/api/event-musicians-finance-sync.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DELETE } from '@/app/api/event-musicians/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    eventMusician: { findUnique: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('@/lib/finance-service', () => ({
  syncMusicianCost: vi.fn(),
  removeMusicianCost: vi.fn(),
}))

function makeDeleteRequest(qs: string): Request {
  return new Request(`http://localhost:3000/api/event-musicians${qs}`, { method: 'DELETE' })
}

describe('DELETE /api/event-musicians — bloqueio de cachê pago', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 409 quando o custo vinculado já está pago e force não foi passado', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { removeMusicianCost } = await import('@/lib/finance-service')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'em-1',
      event: { band_id: 'band-1' },
    } as any)
    vi.mocked(removeMusicianCost).mockResolvedValueOnce({ blocked: true })

    const response = await DELETE(makeDeleteRequest('?id=em-1'))
    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json.requiresConfirmation).toBe(true)
    expect(prisma.eventMusician.delete).not.toHaveBeenCalled()
  })

  it('remove com sucesso quando force=true', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { removeMusicianCost } = await import('@/lib/finance-service')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'em-1',
      event: { band_id: 'band-1' },
    } as any)
    vi.mocked(removeMusicianCost).mockResolvedValueOnce({ blocked: false })
    vi.mocked(prisma.eventMusician.delete).mockResolvedValueOnce({ id: 'em-1' } as any)

    const response = await DELETE(makeDeleteRequest('?id=em-1&force=true'))
    expect(response.status).toBe(200)
    expect(removeMusicianCost).toHaveBeenCalledWith('em-1', true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run __tests__/api/event-musicians-finance-sync.test.ts`
Expected: FAIL — a rota ainda não chama `removeMusicianCost` nem retorna 409.

- [ ] **Step 3: Atualizar a rota**

Em `app/api/event-musicians/route.ts`, adicionar o import no topo:

```ts
import { syncMusicianCost, removeMusicianCost } from '@/lib/finance-service'
```

No `POST`, logo após o bloco que cria `em` (depois de `const em = await prisma.eventMusician.create({...})`), adicionar:

```ts
  await syncMusicianCost(em.id)
```

(antes do `if (musician) { sendEventInviteEmail(...) }`).

No `PATCH`, logo após `const updated = await prisma.eventMusician.update({...})`, adicionar:

```ts
  if ('cache_value' in parsed.data) {
    await syncMusicianCost(updated.id)
  }
```

(antes do `if (wasVacant && isBeingAssigned && musician) { ... }`).

Substituir a função `DELETE` inteira por:

```ts
export async function DELETE(request: Request) {
  const sessionUser = await getAdminOrProducer()
  if (!sessionUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const force = searchParams.get('force') === 'true'
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const em = await prisma.eventMusician.findUnique({
    where: { id },
    include: { event: { select: { band_id: true } } },
  })
  if (!em || em.event.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { blocked } = await removeMusicianCost(id, force)
  if (blocked) {
    return NextResponse.json({
      error: 'Este músico já tem um custo de cachê marcado como pago no financeiro do evento. Confirme a remoção para apagar o custo junto.',
      requiresConfirmation: true,
    }, { status: 409 })
  }

  await prisma.eventMusician.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 4: Rodar os testes de novo**

Run: `npx vitest run __tests__/api/event-musicians-finance-sync.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/api/event-musicians/route.ts __tests__/api/event-musicians-finance-sync.test.ts
git commit -m "feat(api): sincroniza custo de cachê com a Formacao e bloqueia remocao de custo pago"
```

---

## Phase 5 — UI: aba "Financeiro" do evento

### Task 10: `EventFinanceTab` — substitui o placeholder

**Files:**
- Create: `components/producao/EventFinanceTab.tsx`
- Modify: `components/producao/EventTabs.tsx`

- [ ] **Step 1: Criar o componente**

Criar `components/producao/EventFinanceTab.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle } from 'lucide-react'
import {
  fmt,
  DEFAULT_FINANCE_ITEMS,
  PERCENT_ELIGIBLE_CATEGORIES,
  CACHE_MUSICO_CATEGORY,
  type EventFinanceData,
  type EventFinanceTotals,
} from '@/lib/financas'

type FinanceResponse = { data: EventFinanceData; totals: EventFinanceTotals }

async function fetchFinance(eventoId: string): Promise<FinanceResponse> {
  const res = await fetch(`/api/events/${eventoId}/finance`)
  if (!res.ok) throw new Error('Falha ao carregar o financeiro do evento')
  return res.json()
}

function parseBR(raw: string): number {
  return parseFloat(raw.trim().replace(/\./g, '').replace(',', '.'))
}

function CurrencyInput({
  value,
  onCommit,
  className = '',
}: {
  value: number
  onCommit: (n: number) => void
  className?: string
}) {
  const [input, setInput] = useState(fmt(value))
  useEffect(() => setInput(fmt(value)), [value])

  return (
    <input
      type="text"
      value={input}
      onChange={e => setInput(e.target.value)}
      onBlur={() => {
        const parsed = parseBR(input)
        if (!isNaN(parsed) && parsed !== value) onCommit(parsed)
        else setInput(fmt(value))
      }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={`w-32 text-right text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  )
}

function useAutosave() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function trigger(fn: () => Promise<void>) {
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await fn()
      setStatus('saved')
      timer.current = setTimeout(() => setStatus('idle'), 1500)
    }, 600)
  }

  return { status, trigger }
}

export function EventFinanceTab({ eventoId }: { eventoId: string }) {
  const queryClient = useQueryClient()
  const queryKey = ['event-finance', eventoId]
  const { status, trigger } = useAutosave()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchFinance(eventoId),
  })

  async function patchFinance(patch: Record<string, unknown>) {
    trigger(async () => {
      const res = await fetch(`/api/financas/${data!.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) queryClient.invalidateQueries({ queryKey })
    })
  }

  async function patchItem(itemId: string, patch: Record<string, unknown>) {
    trigger(async () => {
      const res = await fetch(`/api/financas/${data!.data.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) queryClient.invalidateQueries({ queryKey })
    })
  }

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-gray-400 animate-pulse">Carregando financeiro...</div>
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
        <p className="text-sm">Não foi possível carregar o financeiro deste evento.</p>
        <button onClick={() => refetch()} className="text-sm underline hover:text-gray-700">Tentar novamente</button>
      </div>
    )
  }

  const { data: finance, totals } = data
  const musicianItems = finance.items.filter(i => i.category === CACHE_MUSICO_CATEGORY)
  const otherItems = DEFAULT_FINANCE_ITEMS.map(def => ({
    def,
    item: finance.items.find(i => i.category === def.category),
  }))

  const cards = [
    { label: 'Receita prevista', value: totals.revenueForecast, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Recebido',         value: totals.received,        color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'A receber',        value: totals.receivable,       color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Custos',           value: totals.costTotal,       color: 'text-red-600', bg: 'bg-red-50' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <span className="text-xs text-gray-400">
          {status === 'saving' && 'Salvando...'}
          {status === 'saved' && 'Salvo'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`rounded-lg border p-4 ${c.bg}`}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-sm font-bold ${c.color}`}>R$ {fmt(c.value)}</p>
          </div>
        ))}
        <div className={`rounded-lg border p-4 ${totals.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-gray-500 mb-1">Lucro / Margem</p>
          <p className={`text-sm font-bold ${totals.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            R$ {fmt(totals.profit)} ({totals.marginPercent === null ? '—' : `${totals.marginPercent.toFixed(1)}%`})
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Receita</h3>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <label className="text-xs text-gray-500">
            Receita prevista
            <CurrencyInput
              value={finance.expected_revenue}
              onCommit={v => patchFinance({ expected_revenue: v })}
              className="w-full mt-1"
            />
          </label>
          <label className="text-xs text-gray-500">
            Valor recebido
            <CurrencyInput
              value={finance.received_amount}
              onCommit={v => patchFinance({ received_amount: v })}
              className="w-full mt-1"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Equipe / Cachês</h3>
        {musicianItems.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum músico com cachê definido na Formação.</p>
        ) : (
          <div className="space-y-2">
            {musicianItems.map(item => (
              <div key={item.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => patchItem(item.id, { paid: !item.paid })} title={item.paid ? 'Marcar como não pago' : 'Marcar como pago'}>
                    {item.paid ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300" />}
                  </button>
                  <span className="text-sm text-gray-700">{item.label}</span>
                </div>
                <CurrencyInput value={item.amount} onCommit={v => patchItem(item.id, { amount: v })} />
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Total da equipe: R$ {fmt(musicianItems.reduce((s, i) => s + i.amount, 0))}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Outros custos</h3>
        <div className="space-y-2">
          {otherItems.map(({ def, item }) => {
            const percentEligible = PERCENT_ELIGIBLE_CATEGORIES.has(def.category)
            return (
              <div key={def.category} className="flex items-center justify-between border rounded-md px-3 py-2 gap-3">
                <div className="flex items-center gap-2 flex-1">
                  {item && (
                    <button onClick={() => patchItem(item.id, { paid: !item.paid })} title={item.paid ? 'Marcar como não pago' : 'Marcar como pago'}>
                      {item.paid ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300" />}
                    </button>
                  )}
                  <span className="text-sm text-gray-700">{def.label}</span>
                </div>
                {percentEligible && item && (
                  <label className="text-xs text-gray-400 flex items-center gap-1">
                    %
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={item.percent_of_revenue ?? ''}
                      placeholder="—"
                      onBlur={e => {
                        const v = e.target.value === '' ? null : parseFloat(e.target.value)
                        patchItem(item.id, { percent_of_revenue: v })
                      }}
                      className="w-16 border rounded px-1 py-0.5 text-right"
                    />
                  </label>
                )}
                {item && <CurrencyInput value={item.amount} onCommit={v => patchItem(item.id, { amount: v })} />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t pt-4 flex flex-wrap gap-6 justify-between text-sm">
        <div>
          <p className="text-gray-500">Resultado do evento</p>
          <p className={`font-bold ${totals.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            R$ {fmt(totals.profit)} ({totals.marginPercent === null ? '—' : `${totals.marginPercent.toFixed(1)}%`})
          </p>
        </div>
        <div>
          <p className="text-gray-500">Saldo em caixa (recebido − pago)</p>
          <p className={`font-bold ${totals.cashProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            R$ {fmt(totals.cashProfit)}
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Trocar o placeholder em `EventTabs.tsx`**

Em `components/producao/EventTabs.tsx`, adicionar o import:

```ts
import { EventFinanceTab } from './EventFinanceTab'
```

E trocar:

```tsx
        {tab === 'financeiro' && <PlaceholderTab label="Financeiro" />}
```

por:

```tsx
        {tab === 'financeiro' && <EventFinanceTab eventoId={eventoId} />}
```

- [ ] **Step 3: Testar manualmente no navegador**

Run: `npm run dev`

No navegador, abrir um evento em `/producao/[eventoId]`, clicar na aba "Financeiro" e confirmar:
- os 5 cards aparecem com valores (mesmo que zerados);
- editar "Receita prevista" e sair do campo atualiza os cards após ~600ms e mostra "Salvo";
- se o evento tiver músicos com cachê na aba Formação, eles aparecem em "Equipe/Cachês";
- marcar um custo como pago move o "Saldo em caixa".

- [ ] **Step 4: Commit**

```bash
git add components/producao/EventFinanceTab.tsx components/producao/EventTabs.tsx
git commit -m "feat(ui): aba Financeiro do evento substitui o placeholder"
```

---

## Phase 6 — UI: tela mensal somente-leitura

### Task 11: `FinanceTable` vira somente-leitura, clique abre o evento

**Files:**
- Modify: `components/financas/FinanceTable.tsx`
- Delete: `components/financas/FinanceCell.tsx` (fica sem nenhum uso depois deste task — confirmar com `grep -rl "FinanceCell" components app` antes de apagar)

- [ ] **Step 1: Atualizar o componente**

Em `components/financas/FinanceTable.tsx`:

1. Adicionar o import de navegação no topo:

```tsx
import { useRouter, useParams } from 'next/navigation'
```

2. Dentro de `FinanceTable`, no início da função, adicionar:

```tsx
  const router = useRouter()
  const { bandSlug } = useParams<{ bandSlug: string }>()

  function openEvent(financeEventId: string | null) {
    if (!financeEventId) return
    router.push(`/${bandSlug}/producao/${financeEventId}?tab=financeiro`)
  }
```

3. Trocar todas as células `FinanceCell` de "Receita prevista", "Valor recebido" e das linhas de `DEFAULT_FINANCE_ITEMS`/customizadas para não aceitarem mais edição — usar `readOnly` e `onClick` para navegar. Por exemplo, a linha de Receita prevista passa de:

```tsx
              <FinanceCell key={f.id} value={f.expected_revenue} colorClass="text-green-700"
                onSave={v => patchFinance(f.id, { expected_revenue: v })} />
```

para:

```tsx
              <td
                key={f.id}
                onClick={() => openEvent(f.event_id)}
                className="px-3 py-2 text-right text-xs font-medium tabular-nums text-green-700 cursor-pointer hover:bg-gray-100"
                title="Abrir evento"
              >
                {fmt(f.expected_revenue)}
              </td>
```

Aplicar o mesmo padrão (célula `<td>` com `onClick={() => openEvent(f.event_id)}`, sem `FinanceCell`) para "Valor recebido" e para cada célula de custo (`DEFAULT_FINANCE_ITEMS` e itens customizados), mantendo as cores (`text-red-600` para custos) e o texto de "pago" já exibido hoje via ícone — o toggle de pago também deixa de existir aqui (só é editável na aba do evento).

4. Remover a seção "Adicionar custo" (linhas 231-261 do arquivo atual) — não faz mais sentido adicionar custo direto na tela mensal.

5. No cabeçalho, trocar o `title` e o texto de confirmação do botão de lixeira para deixar claro que ele não apaga o evento, só desvincula o registro financeiro dele:

```tsx
                    <button
                      onClick={() => deleteFinance(f.id)}
                      className="text-gray-300 hover:text-red-500 mt-1 transition-colors"
                      title="Remover financeiro deste evento"
                    >
```

E em `deleteFinance`, trocar o texto do `confirm`:

```tsx
  async function deleteFinance(id: string) {
    if (!confirm('Remover o registro financeiro deste evento? O evento em si não será apagado.')) return
    const res = await fetch(`/api/financas/${id}`, { method: 'DELETE' })
    if (res.ok) onFinanceDeleted(id)
  }
```

6. Remover as props/funções que não são mais usadas (`patchFinance`, `patchItem`, `addCustomItem`, `deleteItem`, `newItemLabels`, `addingFor`) já que a tabela deixou de ser editável — manter apenas `deleteFinance` (já ajustado acima) e as leituras de dados. Remover também o `import { FinanceCell } from './FinanceCell'`, que deixa de ser usado.

- [ ] **Step 2: Apagar `FinanceCell.tsx`**

Confirmar que não sobrou nenhum uso e remover o arquivo:

Run: `grep -rl "FinanceCell" components app` — esperado: nenhuma saída além do próprio arquivo (que será apagado).
Run: `rm components/financas/FinanceCell.tsx`

- [ ] **Step 3: Testar manualmente**

Run: `npm run dev`

Na tela `/[bandSlug]/financas`, confirmar que:
- nenhuma célula de valor abre um input de edição;
- clicar em qualquer célula de um show (exceto o cabeçalho) navega para `/producao/[eventoId]?tab=financeiro`;
- os totais de "Total mês" continuam batendo com a soma das colunas.

- [ ] **Step 4: Commit**

```bash
git add components/financas/FinanceTable.tsx
git rm components/financas/FinanceCell.tsx
git commit -m "feat(ui): tela mensal de Financas vira somente-leitura, celulas abrem o evento"
```

### Task 12: `AddShowModal` — remove a aba "Entrada avulsa"

**Files:**
- Modify: `components/financas/AddShowModal.tsx`

- [ ] **Step 1: Simplificar o componente**

Em `components/financas/AddShowModal.tsx`, remover todo o estado e JSX relacionados à aba `manual` (`tab`, `PRODUCTS`, `form`, a lista de tabs, e o bloco `tab === 'manual'`). O componente passa a sempre mostrar a lista de eventos disponíveis e enviar apenas `{ event_id: selectedEventId }`:

```tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { EventFinanceData } from '@/lib/financas'

interface AvailableEvent { id: string; client_name: string; event_date: string }

interface AddShowModalProps {
  availableEvents: AvailableEvent[]
  onAdded: (finance: EventFinanceData) => void
  onClose: () => void
}

export function AddShowModal({ availableEvents, onAdded, onClose }: AddShowModalProps) {
  const [selectedEventId, setSelectedEventId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/financas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: selectedEventId }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : 'Erro ao vincular financeiro ao evento')
      return
    }

    const { data } = await res.json()
    onAdded(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Vincular evento ao financeiro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <Label>Evento da produção</Label>
            {availableEvents.length === 0 ? (
              <p className="text-sm text-gray-400 mt-2">Nenhum evento disponível neste mês sem registro financeiro.</p>
            ) : (
              <select
                required
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecionar evento...</option>
                {availableEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.client_name} — {new Date(ev.event_date).toLocaleDateString('pt-BR')}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !selectedEventId}>
              {loading ? 'Vinculando...' : 'Vincular'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar quem chama o modal**

Em `components/financas/FinancasClient.tsx`, o `<AddShowModal>` é chamado com `month`/`year` que não são mais usados pelo componente — remover essas duas props da chamada:

```tsx
        <AddShowModal
          availableEvents={availableEvents}
          onAdded={handleFinanceAdded}
          onClose={() => setShowModal(false)}
        />
```

- [ ] **Step 3: Testar manualmente**

Run: `npm run dev`

Na tela de Finanças, clicar em "+ Adicionar show" e confirmar que só existe a opção de selecionar um evento existente — não há mais campo de nome/cliente/produto/data manual.

- [ ] **Step 4: Commit**

```bash
git add components/financas/AddShowModal.tsx components/financas/FinancasClient.tsx
git commit -m "feat(ui): remove entrada financeira avulsa do modal de adicao"
```

### Task 13: Rodar a suíte inteira e revisar o diff

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Rodar todos os testes**

Run: `npx vitest run`
Expected: todos os testes passam (incluindo os novos desta feature); se algum teste pré-existente que já mockava `EventFinance`/músicos quebrar por causa das mudanças de tipo, ajustar o mock (não a implementação) para refletir os novos campos.

- [ ] **Step 2: Checar tipos do projeto inteiro**

Run: `npx tsc --noEmit`
Expected: 0 erros novos introduzidos por esta feature.

- [ ] **Step 3: Rodar o build**

Run: `npm run build`
Expected: build conclui sem erros (o projeto já ignora erros de TS no build por configuração prévia, mas o build precisa completar).

- [ ] **Step 4: Revisar o diff final**

Run: `git log --oneline main..HEAD` e `git diff main --stat`
Conferir que todos os arquivos listados em "File Structure" no início deste plano foram tocados e nenhum arquivo fora do escopo foi alterado.

---

## Cobertura do spec (autorrevisão)

- Single source of truth / sem entrada avulsa → Tasks 5, 12.
- Agrupamento mensal por `event_date`, sem filtro de status → já é o comportamento de `GET /api/financas`; não precisou de task própria.
- Totais sempre derivados → Tasks 2, 3 (`computeEventFinance`), 10 (UI usa `totals` da API, nunca soma na mão).
- Cachê de músico é custo automático → Tasks 7, 9.
- Comissões percentuais com override → Tasks 2, 6, 10.
- Aba Financeiro do evento → Task 10.
- Tela mensal somente-leitura → Tasks 11, 12.
- Migração / rede de segurança → Tasks 1, 4 (Step 5).
- Testes de `computeEventFinance` cobrindo bordas → Task 3.
- Nenhum `Float` para dinheiro → mantido `Decimal` em todo o fluxo (decisão já validada na spec).
