# Lead Fonte — Campo de Origem do Lead

**Data:** 2026-05-31
**Escopo:** Campo `source` no modelo `Lead` + configuração de opções na página de Configurações
**Abordagem:** Padrão idêntico ao `pipeline_stages` — string no Lead, lista de opções como Json no Band

---

## Objetivo

Adicionar um campo **Fonte** a cada lead, indicando de onde veio o contato (Indicação, Redes Sociais, Tráfego Pago, etc.). O campo é:

- Obrigatório na criação do lead
- Editável no painel de detalhes do lead
- Visível no card do Kanban
- Configurável na página de Configurações (adicionar/editar/remover/reordenar opções)

---

## Arquitetura

### Padrão reutilizado

Segue exatamente o padrão de `pipeline_stages` / `PipelineSettings`:
- Opções armazenadas como `Json?` no model `Band`
- Valor selecionado armazenado como `String?` no model `Lead`
- Componente de settings espelha `PipelineSettings.tsx`
- Rota de API espelha `/api/settings/pipeline`

---

## Camada de Dados

### Mudanças no schema Prisma

**`Band`** — adicionar campo:
```prisma
lead_sources Json?
```

**`Lead`** — adicionar campo:
```prisma
source String?
```

### Opções padrão (hardcoded no componente, aplicadas quando `lead_sources` é null)

```ts
const DEFAULT_SOURCES = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]
```

### Migração

Uma migração Prisma que adiciona duas colunas opcionais (`lead_sources Json?` no Band e `source String?` no Lead). Nenhum dado existente é afetado.

---

## API

### Novo: `/api/settings/sources/route.ts`

Espelha `/api/settings/pipeline/route.ts` exatamente.

**GET** — retorna `band.lead_sources`. Qualquer usuário autenticado.

**PATCH** — atualiza `band.lead_sources`. Somente admin.

Schema de validação:
```ts
z.object({
  sources: z.array(z.object({
    key:   z.string().min(1).regex(/^[a-z0-9_]+$/),
    label: z.string().min(1).max(40),
  })).min(1),
})
```

### Modificado: `POST /api/leads`

Adiciona `source: z.string().min(1)` ao schema de validação — obrigatório.

### Modificado: `PATCH /api/leads/[id]`

Adiciona `source: z.string().optional()` ao schema de validação — opcional na edição (pode ser omitido se não foi alterado).

---

## Componentes

### Novo: `components/configuracoes/SourceSettings.tsx`

Espelha `PipelineSettings.tsx`:
- Prop: `initialSources: Source[] | null`
- Lista de fontes com drag-to-reorder (HTML5 drag & drop, mesmo padrão)
- Cada item: handle de arrasto, Input para editar nome, botão remover (desabilitado se só restar 1)
- Botão "Adicionar fonte"
- Botão "Salvar fontes" — PATCH para `/api/settings/sources`
- Validação: nenhum label vazio

### Modificado: `configuracoes/page.tsx`

Busca `band.lead_sources` junto com `band.pipeline_stages`. Adiciona seção:

```tsx
<section>
  <h2 className="text-lg font-semibold mb-3">Fontes de Lead</h2>
  <SourceSettings initialSources={band?.lead_sources as Source[] | null} />
</section>
```

### Modificado: `comercial/page.tsx`

Adiciona `lead_sources` ao select da banda:
```ts
select: { pipeline_stages: true, lead_sources: true }
```
Passa `leadSources` como prop para `<NewLeadButton>` e `<KanbanBoard>`.

### Modificado: `NewLeadButton.tsx`

Recebe `sources: Source[]` como prop. Passa para `<LeadForm sources={sources}>`.

### Modificado: `KanbanBoard.tsx`

- Recebe `leadSources: Source[] | null` como prop adicional
- Resolve `sources = leadSources ?? DEFAULT_SOURCES`
- O tipo `KanbanLead` ganha `source: string | null`
- Passa `sources` para `<KanbanColumn>` e `<LeadCard>` no `DragOverlay`

### Modificado: `KanbanColumn.tsx`

Recebe `sources: Source[]` como prop adicional. Passa para cada `<LeadCard>`.

### Modificado: `LeadCard.tsx`

- Prop adicional: `sources: Source[]`
- Exibe a label da fonte resolvida abaixo do badge de tipo de evento, como texto pequeno em cinza
- Se `lead.source` for null ou a key não for encontrada na lista, não renderiza nada

### Modificado: `LeadForm.tsx`

- Prop adicional: `sources: Source[]`
- Adiciona campo `Fonte *` — Select obrigatório
- Estado inicial: `source: ''`
- Enviado no body do POST

### Modificado: `[leadId]/page.tsx`

Adiciona `lead_sources` ao select da banda:
```ts
select: { pipeline_stages: true, lead_sources: true }
```
Passa `sources` para `<LeadEditPanel>`. Serializa `lead.source` no objeto passado ao componente.

### Modificado: `LeadEditPanel.tsx`

- Recebe `sources: Source[]` como nova prop
- `LeadData` ganha `source: string | null`
- Form state ganha `source`
- View mode: linha `Fonte: <label>` (ou "Não informada")
- Edit mode: Select com as opções da banda via prop `sources`
- Enviado no body do PATCH

---

## Fluxo de dados

### Configurar fontes (admin)
1. Admin acessa Configurações → seção "Fontes de Lead"
2. Edita, adiciona ou reordena opções
3. Clica "Salvar fontes" → PATCH `/api/settings/sources`
4. `band.lead_sources` atualizado no banco

### Criar lead
1. Usuário abre modal de criação
2. Seleciona Fonte no Select obrigatório (opções vêm de `lead_sources` da banda)
3. POST `/api/leads` com `source` no body
4. `lead.source` salvo como a key da opção selecionada

### Editar fonte de um lead existente
1. Usuário abre painel de detalhes → clica Editar
2. Select de Fonte mostra a opção atual
3. Usuário muda e clica salvar → PATCH `/api/leads/[id]`

### Exibir no card Kanban
1. `KanbanBoard` recebe `lead_sources` da banda
2. Cada `LeadCard` recebe a lista de sources como prop
3. Resolve `lead.source` → label → exibe no card

---

## Tipos

```ts
type Source = { key: string; label: string }
```

`KanbanLead` (em `KanbanBoard.tsx`) ganha `source: string | null`.

`LeadData` (em `LeadEditPanel.tsx`) ganha `source: string | null`.

---

## Tratamento de erros

- **Salvar fontes falha:** mensagem de erro abaixo do form (igual ao PipelineSettings)
- **Criar lead sem fonte:** validação client-side pelo `required` do Select + validação server-side (422)
- **Key inválida no banco:** se `lead.source` não bater com nenhuma opção da lista atual, o card não exibe a fonte (label undefined → não renderiza)

---

## Fora do escopo

- Filtro do Kanban por fonte
- Relatório/analytics por fonte
- Fonte no modelo `Event` (evento já fechado não precisa de fonte)
- Migração de leads existentes (ficam com `source: null`)
