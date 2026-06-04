# Spec: Atrações Contratadas no CRM

**Data:** 2026-06-03
**Status:** Aprovado para implementação

---

## Contexto

A Panel Eventos vende atrações para eventos (bandas, DJs, estruturas de som/luz, etc.). Os vendedores precisam registrar quais atrações um cliente deseja contratar, com valores individuais e total da proposta, diretamente dentro do cadastro do lead.

---

## Objetivos

- Permitir cadastro de atrações disponíveis no catálogo da banda (admin)
- Permitir que vendedores adicionem, editem e removam atrações em cada lead
- Calcular automaticamente o total da proposta com suporte a desconto fixo
- Manter histórico mesmo se uma atração for excluída do catálogo

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Arquitetura | Modelo relacional completo | Padrão do projeto; permite relatórios futuros |
| Layout no lead | Sidebar em abas (Dados / Atrações / Docs) | Mantém espaço limpo sem sobrecarregar a sidebar |
| Desconto | Valor fixo por proposta | Simples e direto para o fluxo do vendedor |
| Snapshot de nome | Sim (campo `name` em `LeadAttraction`) | Preserva histórico se atração for excluída do catálogo |

---

## Modelo de Dados

### Novo modelo: `Attraction`

Catálogo de atrações da banda.

```prisma
model Attraction {
  id            String   @id @default(cuid())
  band_id       String
  name          String
  category      String?
  description   String?
  default_value Decimal  @default(0)
  is_active     Boolean  @default(true)
  created_at    DateTime @default(now())

  band             Band             @relation(fields: [band_id], references: [id], onDelete: Cascade)
  lead_attractions LeadAttraction[]

  @@index([band_id])
}
```

### Novo modelo: `LeadAttraction`

Atrações associadas a um lead específico, com valor customizado por cliente.

```prisma
model LeadAttraction {
  id            String   @id @default(cuid())
  lead_id       String
  attraction_id String?
  name          String
  custom_value  Decimal
  observations  String?
  created_at    DateTime @default(now())

  lead       Lead        @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  attraction Attraction? @relation(fields: [attraction_id], references: [id], onDelete: SetNull)

  @@index([lead_id])
}
```

### Alteração no modelo `Lead`

Adicionar campo de desconto e relação com atrações:

```prisma
proposal_discount Decimal?        @default(0)
lead_attractions  LeadAttraction[]
```

### Alteração no modelo `Band`

Adicionar relação reversa:

```prisma
attractions Attraction[]
```

---

## Rotas de API

### Catálogo (band-level)

| Método | Rota | Descrição | Roles |
|---|---|---|---|
| GET | `/api/attractions` | Lista atrações ativas da banda | admin, commercial |
| POST | `/api/attractions` | Cria nova atração no catálogo | admin |
| PATCH | `/api/attractions/[id]` | Edita atração (nome, valor, status) | admin |
| DELETE | `/api/attractions/[id]` | Remove atração do catálogo | admin |

### Atrações do lead

| Método | Rota | Descrição | Roles |
|---|---|---|---|
| GET | `/api/leads/[id]/attractions` | Lista atrações + subtotal + total | admin, commercial |
| POST | `/api/leads/[id]/attractions` | Adiciona atração ao lead (copia nome como snapshot) | admin, commercial |
| PATCH | `/api/leads/[id]/attractions/[lid]` | Edita valor ou observação no lead | admin, commercial |
| DELETE | `/api/leads/[id]/attractions/[lid]` | Remove atração do lead | admin, commercial |

### Lead (alteração)

- `PATCH /api/leads/[id]` — adicionar suporte ao campo `proposal_discount`

### Resposta do GET `/api/leads/[id]/attractions`

```json
{
  "data": {
    "items": [
      {
        "id": "...",
        "name": "Banda Sapo Brasilis",
        "category": "Banda",
        "custom_value": 12800,
        "observations": "Repertório sertanejo"
      }
    ],
    "subtotal": 19300,
    "discount": 0,
    "total": 19300
  }
}
```

---

## Componentes Frontend

### Novos componentes

| Arquivo | Descrição |
|---|---|
| `components/comercial/LeadAttractions.tsx` | Aba "Atrações" dentro do lead. Lista atrações, permite adicionar/editar/remover, exibe totais. Client component com estado local otimista. |
| `components/configuracoes/AttractionSettings.tsx` | Seção na página de Configurações para admin gerenciar o catálogo. CRUD inline. |

### Componentes alterados

| Arquivo | Alteração |
|---|---|
| `components/comercial/LeadEditPanel.tsx` | Converter sidebar para layout de 3 abas: "Dados", "Atrações", "Documentos". `LeadDocuments` passa para aba própria. |
| `app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx` | Incluir `lead_attractions` no `include` do Prisma; passar `initialAttractions` e `initialDiscount` (de `lead.proposal_discount`) para `LeadAttractions`. O container da sidebar passa a ser uma tab única englobando `LeadEditPanel`, `LeadAttractions` e `LeadDocuments`. |
| `app/(dashboard)/[bandSlug]/configuracoes/page.tsx` | Adicionar seção "Atrações Disponíveis" com `AttractionSettings`. Buscar atrações no `Promise.all`. |
| `prisma/schema.prisma` | Adicionar modelos `Attraction`, `LeadAttraction`; adicionar campos ao `Lead` e `Band`. |

---

## Comportamento da Interface

### Aba "Atrações" no lead

1. Exibe lista de atrações adicionadas com: nome, categoria, valor editável inline, observação editável, botão remover
2. Botão "Adicionar atração" abre um seletor (dropdown/combobox) com as atrações ativas do catálogo
3. Ao selecionar, o valor padrão da atração é pré-preenchido como `custom_value` — editável
4. Campo de desconto (valor fixo) no bloco de totais
5. Cálculo automático: `total = subtotal - discount`
6. Salva cada alteração imediatamente (sem botão de "salvar proposta" separado)

### Catálogo em Configurações

1. Lista todas as atrações da banda (ativas e inativas)
2. Formulário inline para criar nova atração: nome, categoria, descrição, valor padrão
3. Toggle ativo/inativo por item
4. Edição inline de nome e valor padrão
5. Exclusão com confirmação simples

---

## Regras de Negócio

- Um lead pode ter N atrações (sem limite)
- A mesma atração do catálogo pode ser usada em múltiplos leads
- Alterar o valor de uma atração no lead **não altera** o valor padrão do catálogo
- Se uma atração for excluída do catálogo, o campo `name` (snapshot) preserva o nome histórico no lead; `attraction_id` vira `null`
- Atrações inativas não aparecem no seletor de novos leads (mas permanecem visíveis nos leads onde já foram adicionadas)
- Somente `admin` pode gerenciar o catálogo; `admin` e `commercial` podem operar atrações nos leads

---

## Arquivos a Criar

```
prisma/schema.prisma                              (alterar)
app/api/attractions/route.ts                      (novo)
app/api/attractions/[id]/route.ts                 (novo)
app/api/leads/[id]/attractions/route.ts           (novo)
app/api/leads/[id]/attractions/[lid]/route.ts     (novo)
components/comercial/LeadAttractions.tsx          (novo)
components/configuracoes/AttractionSettings.tsx   (novo)
components/comercial/LeadEditPanel.tsx            (alterar)
app/(dashboard)/[bandSlug]/comercial/[leadId]/page.tsx  (alterar)
app/(dashboard)/[bandSlug]/configuracoes/page.tsx       (alterar)
```

---

## Fora do Escopo (desta versão)

- Desconto por percentual
- Relatórios de atrações mais vendidas
- Exportação da proposta em PDF
- Histórico de alterações de preço
