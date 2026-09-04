# Plano de Implementação — Redesign com Abas da Página de Evento

**Spec:** `docs/superpowers/specs/2026-09-03-event-tabs-redesign.md`
**Data:** 2026-09-03

---

## Contexto e Padrões Existentes

### Arquivos-chave
- **Página:** `app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx` — server component, busca dados via Prisma, usa HydrationBoundary
- **Client atual:** `components/producao/EventDetailClient.tsx` — client component, useQuery para checklists + músicos
- **TeamPanel:** `components/producao/TeamPanel.tsx` — lista plana de músicos, mutations de add/remove
- **EventInfoPanel:** `components/producao/EventInfoPanel.tsx` — campos editáveis do evento
- **EventDocuments:** `components/producao/EventDocuments.tsx` — upload/listagem de documentos
- **EventAlignmentNotes:** `components/producao/EventAlignmentNotes.tsx` — notas/alinhamento
- **EventAttractionsEditor:** `components/producao/EventAttractionsEditor.tsx` — atrações do lead

### Padrões a seguir
- Client components com `'use client'` no topo
- Props tipadas com `interface` local no arquivo
- Tailwind para estilização (sem CSS externo)
- Estado de aba controlado via `useState` (não URL params)
- Abas do LeadEditPanel como referência de estilo (ver `components/comercial/LeadEditPanel.tsx` linha 160-173)

---

## Fase 1 — Criar `EventTabs.tsx` (header + abas + conteúdo)

### O que implementar

Criar `components/producao/EventTabs.tsx` — client component que centraliza header, barra de abas e renderização do conteúdo por aba.

**Interface de props:**
```typescript
interface EventTabsProps {
  // Header
  clientName: string
  eventType: string
  eventDate: string        // ISO string
  eventTime: string | null
  venueName: string
  status: string
  musicianCount: number

  // Geral
  event: EventInfo         // prop completa para EventInfoPanel
  attractions: { id: string; name: string }[]
  attractionsTotal: number | null
  assessor: string | null
  assessorPhone: string | null
  leadId: string | null
  leadAttractions: LeadAttraction[]
  initialDiscount: number

  // Formação
  eventoId: string
  bandMembers: { id: string; name: string }[]
  initialTeamNotes: string | null

  // Anexos
  eventId: string
  initialDocs: { id: string; file_name: string; file_url: string; created_at: string }[]

  // Alinhamento (Geral)
  initialNotes: string | null
}
```

**Estrutura do componente:**
```
EventTabs
  ├── Header (fixo, sempre visível)
  │     nome | badge status | tipo | data | horário | local | N músicos
  ├── TabBar
  │     Geral | Formação | Anexos | Financeiro | Tarefas | Chat
  └── TabContent (switch por aba ativa)
        Geral  → EventInfoPanel + EventAttractionsEditor + EventDetailClient(só checklist) + EventAlignmentNotes
        Formação → EventDetailClient(só team) ← separar do checklist
        Anexos → EventDocuments
        outros → placeholder "Em breve"
```

**Atenção:** `EventDetailClient` atual renderiza checklist + equipe juntos. Na Fase 1, extrair para que EventTabs passe `showChecklist` e `showTeam` flags, ou simplesmente renderizar `ChecklistPanel` e `TeamPanel` diretamente em EventTabs (eles já recebem props do useQuery via HydrationBoundary).

**Implementação simplificada:** Renderizar `EventDetailClient` completo na aba Geral (checklist) e criar um segundo wrapper apenas para o TeamPanel na aba Formação — ou refatorar `EventDetailClient` para aceitar `mode: 'checklist' | 'team' | 'all'`.

**Decisão de implementação:** Refatorar `EventDetailClient` para aceitar prop `sections: ('checklist' | 'team')[]` e renderizar só o que for pedido.

**Estilo do TabBar** (copiar padrão de `LeadEditPanel.tsx:160-173`):
```tsx
<button className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
  tab === t
    ? 'border-indigo-500 text-indigo-600'
    : 'border-transparent text-gray-500 hover:text-gray-700'
}`}>
```

**Estilo do Header:**
```tsx
<div className="border-b pb-4 mb-0">
  <div className="flex items-start justify-between">
    <div>
      <h1 className="text-2xl font-bold">{clientName}</h1>
      <p className="text-sm text-gray-500 mt-0.5">{eventTypeLabel}</p>
    </div>
    <span className={`badge ${statusColor}`}>{statusLabel}</span>
  </div>
  <div className="flex gap-4 mt-2 text-sm text-gray-500 flex-wrap">
    <span>📅 {dateFormatted}</span>
    <span>🕐 {eventTime ?? '—'}</span>
    <span>📍 {venueName}</span>
    <span>👥 {musicianCount} músico{musicianCount !== 1 ? 's' : ''}</span>
  </div>
</div>
```

### Verificação
- [ ] Arquivo `components/producao/EventTabs.tsx` existe com `'use client'`
- [ ] Header renderiza com nome, status, tipo, data, horário, local e contagem
- [ ] 6 abas visíveis: Geral, Formação, Anexos, Financeiro, Tarefas, Chat
- [ ] Aba ativa destacada com underline indigo
- [ ] Aba Geral ativa por padrão ao carregar
- [ ] TypeScript compila sem erros: `npx tsc --noEmit`

---

## Fase 2 — Refatorar `EventDetailClient.tsx` para aceitar `sections`

### O que implementar

Adicionar prop `sections: ('checklist' | 'team')[]` ao `EventDetailClient`. Quando `sections` contém apenas `'checklist'`, renderiza só o `ChecklistPanel`. Quando contém apenas `'team'`, renderiza só o `TeamPanel`.

**Mudança no type Props:**
```typescript
type Props = {
  eventoId: string
  bandMembers: BandMember[]
  initialTeamNotes?: string | null
  sections?: ('checklist' | 'team')[]  // default: ['checklist', 'team']
}
```

**Mudança no return:**
```tsx
return (
  <>
    {(!sections || sections.includes('checklist')) && (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Checklists Operacionais</h2>
        <ChecklistPanel checklists={data?.checklists ?? []} eventoId={eventoId} />
      </div>
    )}
    {(!sections || sections.includes('team')) && (
      <div>
        <TeamPanel ... />
      </div>
    )}
  </>
)
```

### Verificação
- [ ] `EventDetailClient` aceita prop `sections` opcional
- [ ] Passando `sections={['checklist']}` não renderiza TeamPanel
- [ ] Passando `sections={['team']}` não renderiza ChecklistPanel
- [ ] Omitir `sections` mantém comportamento original (ambos renderizam)
- [ ] TypeScript compila sem erros

---

## Fase 3 — Atualizar visual do `TeamPanel.tsx` para cards

### O que implementar

Substituir a lista plana de músicos por cards visuais. Cada card ocupa largura total (1 coluna) com layout horizontal.

**Layout do card:**
```tsx
<div className="flex items-center gap-3 p-4 border rounded-xl bg-white shadow-sm">
  {/* Ícone grande do instrumento */}
  <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-2xl flex-shrink-0">
    {POSITION_ICONS[em.instrument ?? ''] ?? '🎵'}
  </div>

  {/* Info */}
  <div className="flex-1 min-w-0">
    <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
      {em.instrument ?? 'Sem posição'}
    </p>
    <p className="text-sm font-semibold text-gray-900 truncate">
      {em.user.name}
    </p>
  </div>

  {/* Status badge */}
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.className}`}>
    {cfg.label}
  </span>

  {/* Ações */}
  <button onClick={() => handleCopyLink(...)} ...><Link2 size={14} /></button>
  <button onClick={() => removeMutation.mutate(em.id)} ...><X size={16} /></button>
</div>
```

**Manter:**
- Lógica de `addMutation`, `removeMutation`, `copyLink` — sem alteração
- Formulário de adicionar (selects + botão) — sem alteração
- Seção de Observações Equipe Escalada — sem alteração

### Verificação
- [ ] Cada músico exibe como card com ícone, instrumento, nome e status
- [ ] Cards têm borda arredondada e shadow sutil
- [ ] Ações (copiar link, remover) funcionam igual ao anterior
- [ ] Estado "Vaga aberta" não existe neste fluxo (músico sempre tem nome)
- [ ] Formulário de adicionar permanece ao final

---

## Fase 4 — Refatorar `page.tsx` para usar `EventTabs`

### O que implementar

Substituir o layout vertical atual pelo novo `EventTabs`. Remover o `div.space-y-8` e renderizar apenas `<EventTabs .../>` dentro do `HydrationBoundary`.

**Mudança no page.tsx:**
```tsx
// Remover:
<div className="space-y-8 max-w-4xl">
  <EventInfoPanel ... />
  <EventAttractionsEditor ... />
  <EventDetailClient ... />
  <EventDocuments ... />
  <EventAlignmentNotes ... />
</div>

// Adicionar:
<EventTabs
  clientName={event.client_name}
  eventType={event.event_type}
  eventDate={event.event_date.toISOString()}
  eventTime={event.event_time ?? null}
  venueName={event.venue_name}
  status={event.status}
  musicianCount={event.event_musicians.length}
  event={{ id: event.id, client_name: event.client_name, ... }}
  attractions={attractions.map(a => ({ id: a.id, name: a.name }))}
  attractionsTotal={attractionsTotal}
  assessor={event.lead?.assessor ?? null}
  assessorPhone={event.lead?.assessor_phone ?? null}
  leadId={event.lead?.id ?? null}
  leadAttractions={attractions.map(a => ({ ... }))}
  initialDiscount={discount}
  eventoId={eventoId}
  bandMembers={bandMembers}
  initialTeamNotes={event.team_notes ?? null}
  eventId={eventoId}
  initialDocs={event.documents.map(d => ({ ... }))}
  initialNotes={event.notes ?? null}
/>
```

**Import a adicionar:**
```tsx
import { EventTabs } from '@/components/producao/EventTabs'
```

**Imports a remover:**
```tsx
// Remover imports de EventInfoPanel, EventAttractionsEditor, EventDetailClient,
// EventDocuments, EventAlignmentNotes (todos passam a ser usados dentro de EventTabs)
```

### Verificação
- [ ] `page.tsx` importa apenas `EventTabs` (além de Prisma/Supabase)
- [ ] Página carrega sem erro no browser
- [ ] Header exibe dados corretos do evento
- [ ] Aba Geral mostra todos os campos editáveis
- [ ] Aba Formação mostra equipe escalada com cards
- [ ] Aba Anexos mostra documentos existentes
- [ ] Abas Financeiro, Tarefas, Chat mostram placeholder
- [ ] TypeScript compila: `npx tsc --noEmit`
- [ ] Edição de campos na aba Geral funciona normalmente
- [ ] Adicionar/remover músico na aba Formação funciona normalmente

---

## Fase 5 — Verificação Final

```bash
npx tsc --noEmit
```

Checklist manual no browser (URL: `/banda-sapo-brasilis/producao/[id]`):
- [ ] Header sempre visível ao trocar abas
- [ ] Nenhum campo ou funcionalidade sumiu
- [ ] Sem erros no console do browser
- [ ] Trocar de aba não causa loading/spinner desnecessário
- [ ] Commit e push para produção

---

## Ordem de Execução

```
Fase 2 (EventDetailClient sections) →
Fase 3 (TeamPanel cards) →
Fase 1 (EventTabs novo componente) →
Fase 4 (page.tsx usa EventTabs) →
Fase 5 (verificação)
```

> Fase 2 antes da Fase 1 porque EventTabs vai importar EventDetailClient com a nova prop.
> Fase 3 independente, pode ser feita em paralelo com Fase 2.
