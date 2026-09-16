# Configurações — seções recolhíveis (accordion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar as 5 seções da página de Configurações (Assinatura, Membros da Banda, Etapas do Pipeline, Fontes de Lead, Atrações Disponíveis) em cards recolhíveis (accordion), com contagem no cabeçalho e scroll interno para listas longas, sem alterar nenhuma regra de negócio, rota de API ou schema.

**Architecture:** Um novo componente genérico `SettingsSection` (Card + cabeçalho clicável + animação CSS grid-rows, sem desmontar o conteúdo) envolve cada seção existente na `page.tsx`. Os componentes internos (`MemberList`, `PipelineSettings`, `SourceSettings`, `AttractionSettings`) recebem apenas ajustes pontuais de scroll/busca/responsividade — nenhuma lógica de dados é alterada.

**Tech Stack:** Next.js (App Router, Server Components), React 18+ client components, Tailwind CSS (sem novas dependências), lucide-react, Vitest + Testing Library (jsdom).

Spec de referência: `docs/superpowers/specs/2026-09-16-configuracoes-accordion-design.md`

---

### Task 1: Componente `SettingsSection` (accordion genérico)

**Files:**
- Create: `components/configuracoes/SettingsSection.tsx`
- Test: `__tests__/components/configuracoes/SettingsSection.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// __tests__/components/configuracoes/SettingsSection.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsSection } from '@/components/configuracoes/SettingsSection'

describe('SettingsSection', () => {
  it('inicia fechado por padrão, mostrando título e descrição', () => {
    render(
      <SettingsSection title="Membros da Banda" description="9 membros">
        <p>Conteúdo interno</p>
      </SettingsSection>
    )
    expect(screen.getByText('Membros da Banda')).toBeInTheDocument()
    expect(screen.getByText('9 membros')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Membros da Banda/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('abre ao clicar no cabeçalho, atualizando aria-expanded', async () => {
    const user = userEvent.setup()
    render(
      <SettingsSection title="Etapas do Pipeline" description="6 etapas">
        <p>Conteúdo interno</p>
      </SettingsSection>
    )
    const header = screen.getByRole('button', { name: /Etapas do Pipeline/ })
    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('mantém o conteúdo montado mesmo quando a seção está fechada', () => {
    render(
      <SettingsSection title="Fontes de Lead" description="5 fontes">
        <p>Conteúdo interno</p>
      </SettingsSection>
    )
    // A seção inicia fechada (defaultOpen não informado), mas o filho
    // precisa continuar no DOM para preservar estado não salvo.
    expect(screen.getByText('Conteúdo interno')).toBeInTheDocument()
  })

  it('respeita defaultOpen quando informado', () => {
    render(
      <SettingsSection title="Assinatura" description="Resumo do plano atual" defaultOpen>
        <p>Conteúdo interno</p>
      </SettingsSection>
    )
    expect(screen.getByRole('button', { name: /Assinatura/ })).toHaveAttribute('aria-expanded', 'true')
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx vitest run __tests__/components/configuracoes/SettingsSection.test.tsx`
Expected: FAIL — `Cannot find module '@/components/configuracoes/SettingsSection'`

- [ ] **Step 3: Implementar o componente**

```tsx
// components/configuracoes/SettingsSection.tsx
'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  title: string
  description: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function SettingsSection({
  title,
  description,
  defaultOpen = false,
  children,
}: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted-foreground truncate">{description}</span>
        </span>
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      <div
        id={contentId}
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
      >
        <div className="overflow-hidden">
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t">
            <div className="pt-4">{children}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx vitest run __tests__/components/configuracoes/SettingsSection.test.tsx`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add components/configuracoes/SettingsSection.tsx __tests__/components/configuracoes/SettingsSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(configuracoes): adiciona SettingsSection (accordion sem desmontar conteudo)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extrair defaults compartilhados de Pipeline/Fontes

**Files:**
- Create: `lib/settings-defaults.ts`
- Modify: `components/configuracoes/PipelineSettings.tsx:1-18`
- Modify: `components/configuracoes/SourceSettings.tsx:1-15`

Motivo: `page.tsx` (Server Component) vai precisar da mesma lógica de fallback para calcular a contagem exibida no cabeçalho fechado ("6 etapas") sem duplicar os arrays `DEFAULT_STAGES`/`DEFAULT_SOURCES` que hoje só existem dentro dos componentes client. Extração pura de constantes — nenhuma lógica de componente muda.

- [ ] **Step 1: Criar o módulo compartilhado**

```ts
// lib/settings-defaults.ts
export type PipelineStage = { key: string; label: string }
export type LeadSource = { key: string; label: string }

export const DEFAULT_STAGES: PipelineStage[] = [
  { key: 'new_lead',      label: 'Novo Lead' },
  { key: 'attending',     label: 'Em Atendimento' },
  { key: 'proposal_sent', label: 'Proposta Enviada' },
  { key: 'negotiation',   label: 'Negociação' },
  { key: 'closed',        label: 'Fechado' },
  { key: 'lost',          label: 'Perdido' },
]

export const DEFAULT_SOURCES: LeadSource[] = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]
```

- [ ] **Step 2: Atualizar `PipelineSettings.tsx` para importar do módulo**

Substituir as linhas 1-18 de `components/configuracoes/PipelineSettings.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { DEFAULT_STAGES, type PipelineStage as Stage } from '@/lib/settings-defaults'

interface PipelineSettingsProps {
  initialStages: Stage[] | null
}
```

(O restante do arquivo, a partir de `export function PipelineSettings...`, continua idêntico.)

- [ ] **Step 3: Atualizar `SourceSettings.tsx` para importar do módulo**

Substituir as linhas 1-15 de `components/configuracoes/SourceSettings.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { DEFAULT_SOURCES, type LeadSource as Source } from '@/lib/settings-defaults'

interface SourceSettingsProps {
  initialSources: Source[] | null
}
```

(O restante do arquivo, a partir de `export function SourceSettings...`, continua idêntico.)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `PipelineSettings.tsx`, `SourceSettings.tsx` ou `lib/settings-defaults.ts` (o projeto já tem erros pré-existentes em outros módulos — não introduzir novos).

- [ ] **Step 5: Commit**

```bash
git add lib/settings-defaults.ts components/configuracoes/PipelineSettings.tsx components/configuracoes/SourceSettings.tsx
git commit -m "$(cat <<'EOF'
refactor(configuracoes): extrai DEFAULT_STAGES/DEFAULT_SOURCES para lib/settings-defaults

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Busca e scroll interno em `MemberList`

**Files:**
- Modify: `components/configuracoes/MemberList.tsx`
- Test: `__tests__/components/configuracoes/MemberList.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// __tests__/components/configuracoes/MemberList.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemberList } from '@/components/configuracoes/MemberList'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

function makeMembers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `Membro ${i}`,
    email: `membro${i}@banda.com`,
    role: 'musician',
  }))
}

describe('MemberList', () => {
  it('não mostra campo de busca com poucos membros', () => {
    render(<MemberList members={makeMembers(3)} currentUserId="0" />)
    expect(screen.queryByPlaceholderText('Buscar membro...')).not.toBeInTheDocument()
  })

  it('mostra campo de busca quando há mais de 8 membros', () => {
    render(<MemberList members={makeMembers(9)} currentUserId="0" />)
    expect(screen.getByPlaceholderText('Buscar membro...')).toBeInTheDocument()
  })

  it('filtra membros por nome ao digitar na busca', async () => {
    const user = userEvent.setup()
    render(<MemberList members={makeMembers(9)} currentUserId="0" />)
    await user.type(screen.getByPlaceholderText('Buscar membro...'), 'Membro 3')
    expect(screen.getByText('Membro 3')).toBeInTheDocument()
    expect(screen.queryByText('Membro 1')).not.toBeInTheDocument()
  })

  it('mostra mensagem quando a busca não encontra ninguém', async () => {
    const user = userEvent.setup()
    render(<MemberList members={makeMembers(9)} currentUserId="0" />)
    await user.type(screen.getByPlaceholderText('Buscar membro...'), 'zzz')
    expect(screen.getByText('Nenhum membro encontrado.')).toBeInTheDocument()
  })

  it('aplica scroll interno quando há mais de 5 membros', () => {
    render(<MemberList members={makeMembers(6)} currentUserId="0" />)
    expect(screen.getByTestId('member-list')).toHaveClass('max-h-80', 'overflow-y-auto')
  })

  it('não aplica scroll interno com 5 membros ou menos', () => {
    render(<MemberList members={makeMembers(5)} currentUserId="0" />)
    expect(screen.getByTestId('member-list')).not.toHaveClass('max-h-80')
  })
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `npx vitest run __tests__/components/configuracoes/MemberList.test.tsx`
Expected: FAIL — placeholder "Buscar membro..." e `data-testid="member-list"` ainda não existem.

- [ ] **Step 3: Implementar as mudanças em `MemberList.tsx`**

Substituir o arquivo `components/configuracoes/MemberList.tsx` inteiro por:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, Trash2, Loader2, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const roleLabels: Record<string, string> = {
  admin:      'Admin',
  commercial: 'Comercial',
  producer:   'Produtor',
  musician:   'Músico',
  singer:     'Cantor(a)',
}

type MemberItem = {
  id: string
  name: string
  email: string
  role: string
}

interface MemberListProps {
  members: MemberItem[]
  currentUserId: string
}

const SEARCH_THRESHOLD = 8
const SCROLL_THRESHOLD = 5

export function MemberList({ members, currentUserId }: MemberListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    )
  }, [members, query])

  async function handleDelete(member: MemberItem) {
    if (!confirm(`Remover ${member.name} da banda?`)) return
    setDeletingId(member.id)
    const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) {
      toast({ title: `${member.name} removido da banda.` })
      router.refresh()
    } else {
      const json = await res.json().catch(() => ({}))
      toast({ title: json.error ?? 'Erro ao remover membro', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-2">
      {members.length > SEARCH_THRESHOLD && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar membro..."
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div
        data-testid="member-list"
        className={cn(
          'border rounded-lg divide-y',
          members.length > SCROLL_THRESHOLD && 'max-h-80 overflow-y-auto'
        )}
      >
        {filteredMembers.map(member => {
          const isSelf = member.id === currentUserId
          return (
            <div key={member.id} className="flex items-center gap-3 p-3">
              <Avatar>
                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {member.name}
                  {isSelf && <span className="text-gray-400 text-xs ml-2">(você)</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{member.email}</p>
              </div>
              <Badge variant="outline">{roleLabels[member.role] ?? member.role}</Badge>
              {!isSelf && (
                <button
                  onClick={() => handleDelete(member)}
                  disabled={deletingId === member.id}
                  className="ml-1 p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Remover membro"
                >
                  {deletingId === member.id
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Trash2 size={15} />
                  }
                </button>
              )}
            </div>
          )
        })}
        {filteredMembers.length === 0 && (
          <p className="p-3 text-sm text-gray-400">Nenhum membro encontrado.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `npx vitest run __tests__/components/configuracoes/MemberList.test.tsx`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add components/configuracoes/MemberList.tsx __tests__/components/configuracoes/MemberList.test.tsx
git commit -m "$(cat <<'EOF'
feat(configuracoes): adiciona busca e scroll interno em MemberList

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Scroll interno em Pipeline, Fontes e Atrações

**Files:**
- Modify: `components/configuracoes/PipelineSettings.tsx:84` (linha do `<div className="space-y-2">` que envolve a lista)
- Modify: `components/configuracoes/SourceSettings.tsx:81`
- Modify: `components/configuracoes/AttractionSettings.tsx:120`

Mudança puramente visual (classe condicional de `max-height`/`overflow`), sem lógica nova — não requer teste dedicado. Os botões "Adicionar etapa/fonte" e "Salvar etapas/fontes" já ficam **fora** desse `div` em todos os três arquivos (confirmado na leitura atual do código), então continuam sempre visíveis, nunca escondidos pelo scroll interno.

- [ ] **Step 1: `PipelineSettings.tsx` — adicionar `cn` e scroll condicional**

No topo do arquivo, adicionar o import (junto aos demais):

```tsx
import { cn } from '@/lib/utils'
```

Substituir a linha 84 (`<div className="space-y-2">`) por:

```tsx
      <div className={cn('space-y-2', stages.length > 6 && 'max-h-72 overflow-y-auto pr-1')}>
```

- [ ] **Step 2: `SourceSettings.tsx` — mesmo ajuste**

Adicionar import `import { cn } from '@/lib/utils'` no topo, e substituir a linha 81 (`<div className="space-y-2">`) por:

```tsx
      <div className={cn('space-y-2', sources.length > 6 && 'max-h-72 overflow-y-auto pr-1')}>
```

- [ ] **Step 3: `AttractionSettings.tsx` — mesmo ajuste**

Adicionar import `import { cn } from '@/lib/utils'` no topo, e substituir a linha 120 (`<div className="space-y-2">`) por:

```tsx
      <div className={cn('space-y-2', attractions.length > 6 && 'max-h-72 overflow-y-auto pr-1')}>
```

- [ ] **Step 4: Verificar visualmente**

Run: `npm run dev` e abrir `/{bandSlug}/configuracoes` no navegador. Adicionar temporariamente (via UI, sem salvar) mais de 6 etapas/fontes e confirmar que a lista ganha scroll interno e os botões continuam visíveis abaixo.

- [ ] **Step 5: Commit**

```bash
git add components/configuracoes/PipelineSettings.tsx components/configuracoes/SourceSettings.tsx components/configuracoes/AttractionSettings.tsx
git commit -m "$(cat <<'EOF'
feat(configuracoes): limita altura das listas de etapas/fontes/atracoes com scroll interno

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Responsividade dos formulários inline

**Files:**
- Modify: `components/configuracoes/AddMember.tsx:67`
- Modify: `components/configuracoes/AttractionSettings.tsx:127,192`

- [ ] **Step 1: `AddMember.tsx` — grid responsivo**

Substituir a linha 67 (`<div className="grid grid-cols-2 gap-3">`) por:

```tsx
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

- [ ] **Step 2: `AttractionSettings.tsx` — grid responsivo (edição inline, linha 127)**

Substituir:

```tsx
              <div className="flex-1 grid grid-cols-2 gap-2">
```

por:

```tsx
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
```

- [ ] **Step 3: `AttractionSettings.tsx` — grid responsivo (nova atração, linha 192)**

Substituir:

```tsx
          <div className="grid grid-cols-2 gap-2">
```

por:

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
```

- [ ] **Step 4: Verificar visualmente em largura mobile**

Run: `npm run dev`, abrir DevTools do navegador em modo responsivo (~375px de largura) e confirmar que os formulários de "Adicionar membro" e "Nova atração"/edição de atração empilham em uma coluna sem cortar texto.

- [ ] **Step 5: Commit**

```bash
git add components/configuracoes/AddMember.tsx components/configuracoes/AttractionSettings.tsx
git commit -m "$(cat <<'EOF'
fix(configuracoes): formularios inline empilham em uma coluna no mobile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Integrar `SettingsSection` na página de Configurações

**Files:**
- Modify: `app/(dashboard)/[bandSlug]/configuracoes/page.tsx` (arquivo inteiro)

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
// app/(dashboard)/[bandSlug]/configuracoes/page.tsx
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { SubscriptionStatus } from '@/components/configuracoes/SubscriptionStatus'
import { MemberList } from '@/components/configuracoes/MemberList'
import { AddMember } from '@/components/configuracoes/AddMember'
import { PipelineSettings } from '@/components/configuracoes/PipelineSettings'
import { SourceSettings } from '@/components/configuracoes/SourceSettings'
import { AttractionSettings } from '@/components/configuracoes/AttractionSettings'
import { SettingsSection } from '@/components/configuracoes/SettingsSection'
import { DEFAULT_STAGES, DEFAULT_SOURCES } from '@/lib/settings-defaults'

export default async function ConfiguracoesPage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: user.id },
    include: { band: true },
  })

  if (!dbUser) redirect('/login')
  if (dbUser.role !== 'admin') redirect(`/${bandSlug}`)

  // Validate band membership
  if (!dbUser.band || dbUser.band.slug !== bandSlug) return notFound()

  const [members, band, attractions] = await Promise.all([
    prisma.user.findMany({
      where: { band_id: dbUser.band_id },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.band.findUnique({
      where: { id: dbUser.band_id },
      select: { pipeline_stages: true, lead_sources: true },
    }),
    prisma.attraction.findMany({
      where: { band_id: dbUser.band_id },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    }),
  ])

  const stageCount =
    (band?.pipeline_stages as { key: string; label: string }[] | null)?.length ??
    DEFAULT_STAGES.length
  const sourceCount =
    (band?.lead_sources as { key: string; label: string }[] | null)?.length ??
    DEFAULT_SOURCES.length

  return (
    <div className="p-6 space-y-6 max-w-2xl md:max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-gray-500 text-sm">{dbUser.band.name}</p>
      </div>

      <div className="space-y-3">
        <SettingsSection title="Assinatura" description="Resumo do plano atual">
          <SubscriptionStatus hasAsaasId={!!dbUser.band.asaas_id} />
        </SettingsSection>

        <SettingsSection
          title="Membros da Banda"
          description={`${members.length} ${members.length === 1 ? 'membro' : 'membros'}`}
        >
          <div className="space-y-3">
            <AddMember />
            <MemberList members={members} currentUserId={dbUser.id} />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Etapas do Pipeline"
          description={`${stageCount} ${stageCount === 1 ? 'etapa' : 'etapas'}`}
        >
          <PipelineSettings
            initialStages={band?.pipeline_stages as { key: string; label: string }[] | null}
          />
        </SettingsSection>

        <SettingsSection
          title="Fontes de Lead"
          description={`${sourceCount} ${sourceCount === 1 ? 'fonte' : 'fontes'}`}
        >
          <SourceSettings
            initialSources={band?.lead_sources as { key: string; label: string }[] | null}
          />
        </SettingsSection>

        <SettingsSection
          title="Atrações Disponíveis"
          description={`${attractions.length} ${attractions.length === 1 ? 'atração cadastrada' : 'atrações cadastradas'}`}
        >
          <AttractionSettings
            initialAttractions={attractions.map(a => ({
              id: a.id,
              name: a.name,
              category: a.category,
              description: a.description,
              default_value: parseFloat(a.default_value.toString()),
              is_active: a.is_active,
            }))}
          />
        </SettingsSection>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros introduzidos por este arquivo.

- [ ] **Step 3: Rodar toda a suíte de testes de Configurações**

Run: `npx vitest run __tests__/components/configuracoes`
Expected: PASS (todos os testes das Tasks 1 e 3)

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/[bandSlug]/configuracoes/page.tsx"
git commit -m "$(cat <<'EOF'
feat(configuracoes): envolve todas as secoes em SettingsSection recolhivel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Verificação manual completa (dev server)

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Subir o dev server e abrir a página**

Run: `npm run dev`
Abrir `http://localhost:3000/{bandSlug}/configuracoes` logado como admin.

- [ ] **Step 2: Checklist funcional**

Confirmar manualmente, no navegador:
- Todas as 5 seções iniciam fechadas, mostrando título + contagem (ex.: "Membros da Banda · 9 membros").
- Clicar no cabeçalho abre/fecha com animação suave (~200ms), chevron gira 180°.
- Múltiplas seções podem ficar abertas ao mesmo tempo (abrir "Membros da Banda" e depois "Etapas do Pipeline" sem fechar a primeira).
- Abrir "Membros da Banda", digitar em um campo do formulário "+ Adicionar membro" (sem enviar), fechar a seção e reabri-la: o texto digitado ainda está lá.
- Com mais de 5 membros/etapas/fontes/atrações (usar dados de teste ou adicionar temporariamente), a lista interna ganha scroll e os botões de ação continuam visíveis.
- Testar reordenar etapas via drag-and-drop, editar nome, excluir e "Salvar etapas" — comportamento idêntico ao anterior.
- Testar em largura mobile (~375px) e tablet (~768px) via DevTools: cards não quebram, formulários empilham em uma coluna.

- [ ] **Step 3: Rodar a suíte completa de testes**

Run: `npx vitest run`
Expected: todos os testes passam (nenhuma regressão nos testes pré-existentes, ex. `__tests__/lib/role-guard.test.tsx`).

- [ ] **Step 4: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros novos relacionados às mudanças desta feature.

Nenhum commit neste task — é só verificação. Se algo falhar, voltar à task correspondente, corrigir e commitar a correção.
