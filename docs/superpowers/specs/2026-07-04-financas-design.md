# Finanças — Design Spec
**Data:** 2026-07-04  
**Status:** Aprovado

---

## Objetivo

Adicionar uma página "Finanças" ao CRM PanelAp para acompanhar receita, recebimentos, custos e lucro por show/evento em formato de planilha mensal.

---

## Modelo de Dados

### `EventFinance`
Um registro por show financeiro. Pode estar vinculado a um `Event` existente (campo `event_id`) ou ser uma entrada avulsa (`event_id = null`).

| Campo            | Tipo     | Notas                                          |
|------------------|----------|------------------------------------------------|
| id               | String   | cuid                                           |
| band_id          | String   | FK Band                                        |
| event_id         | String?  | FK Event (null = entrada avulsa)               |
| name             | String   | Nome do show                                   |
| client           | String?  | Nome do cliente                                |
| product          | String?  | Produto contratado (Sapo Brasilis, DJ, etc.)   |
| event_date       | DateTime | Data do show                                   |
| expected_revenue | Decimal  | Receita prevista                               |
| received_amount  | Decimal  | Valor recebido                                 |
| notes            | String?  | Observações gerais                             |
| created_at       | DateTime |                                                |
| updated_at       | DateTime |                                                |

### `EventFinanceItem`
Uma linha financeira por show. Criados automaticamente ao criar um `EventFinance` com os itens padrão (valor 0). Usuário pode adicionar itens extras.

| Campo      | Tipo    | Notas                                              |
|------------|---------|----------------------------------------------------|
| id         | String  | cuid                                               |
| finance_id | String  | FK EventFinance                                    |
| category   | String  | slug da categoria (ex: `pro_labore`, `cantor_1`)   |
| label      | String  | Label exibido na tabela (editável)                 |
| amount     | Decimal | Valor do item                                      |
| paid       | Boolean | Se foi pago (default false)                        |
| notes      | String? |                                                    |
| created_at | DateTime|                                                    |

### Itens pré-criados por show (categoria → label padrão)

**Receita:**
- `receita_prevista` → Receita prevista *(armazenada no EventFinance.expected_revenue)*
- `valor_recebido` → Valor recebido *(armazenada no EventFinance.received_amount)*

**Custos (EventFinanceItem):**
- `pro_labore` → Pró-labore
- `comissao_panel` → Comissão Panel
- `comissao_vendedor` → Comissão vendedor
- `nota_fiscal` → Nota fiscal
- `visita_tecnica` → Visita técnica
- `bv_cerimonial` → BV cerimonial
- `alimentacao_extra` → Alimentação extra
- `transporte` → Transporte
- `hospedagem` → Hospedagem
- `cantor_1` → Cantor 1
- `cantor_2` → Cantor 2
- `cantor_3` → Cantor 3
- `cantor_4` → Cantor 4
- `guitarrista` → Guitarrista
- `baixista` → Baixista
- `baterista` → Bateria
- `tecladista` → Teclado
- `percussao` → Percussão
- `sanfoneiro` → Sanfoneiro
- `dj` → DJ
- `tecnico_som` → Técnico de som
- `tecnico_luz` → Técnico de luz
- `outros` → Outros custos

### Campos calculados (frontend, não persistidos)
- **Saldo a receber** = expected_revenue − received_amount
- **Custo total** = soma de todos os `EventFinanceItem.amount`
- **Lucro previsto** = expected_revenue − custo total
- **Lucro real** = received_amount − soma dos itens com `paid = true`
- **Margem %** = (lucro previsto / expected_revenue) × 100

---

## Rotas e API

### Página
`/[bandSlug]/financas` — server component, passa dados iniciais ao client

### Endpoints

| Método | Rota                                      | Ação                                          |
|--------|-------------------------------------------|-----------------------------------------------|
| GET    | `/api/financas?month=&year=`             | Lista EventFinances do mês para a banda       |
| POST   | `/api/financas`                          | Cria novo EventFinance + itens padrão         |
| PATCH  | `/api/financas/[id]`                     | Edita cabeçalho do show (name, revenue, etc.) |
| DELETE | `/api/financas/[id]`                     | Exclui show financeiro e seus itens           |
| PATCH  | `/api/financas/[id]/items/[itemId]`      | Edita valor/status de um item                 |
| POST   | `/api/financas/[id]/items`               | Adiciona item personalizado                   |
| DELETE | `/api/financas/[id]/items/[itemId]`      | Remove item personalizado                     |

**Pré-preenchimento ao vincular Event existente:**
- `name` ← `event.client_name`
- `client` ← `event.client_name`
- `event_date` ← `event.event_date`
- `expected_revenue` ← soma das atrações do lead (LeadAttraction.custom_value − proposal_discount)

---

## Interface

### Layout Geral
```
Finanças          [◀ Jul 2026 ▶]            [+ Adicionar show]

[ Receita R$xx ]  [ Recebido R$xx ]  [ A Receber R$xx ]  [ Custos R$xx ]  [ Lucro xx% ]

────────────────────────────────────────────────────────────────────
                  │  Show 1   │  Show 2   │  Show 3   │  TOTAL MÊS
────────────────────────────────────────────────────────────────────
Receita prevista  │  15.000   │  20.000   │  10.000   │  45.000
Valor recebido    │  10.000   │  15.000   │   5.000   │  30.000
Saldo a receber   │   5.000   │   5.000   │   5.000   │  15.000
── CUSTOS ──      │           │           │           │
Pró-labore        │   2.000   │   2.000   │   1.500   │   5.500
...               │    ...    │    ...    │    ...    │    ...
── TOTAL CUSTOS   │   6.000   │   8.000   │   4.000   │  18.000
── LUCRO FINAL    │   9.000   │  12.000   │   6.000   │  27.000
+ Custo           │           │           │           │
```

### Comportamento das células
- Clique em valor numérico → input inline; salva no `onBlur`
- Linhas calculadas (Saldo, Lucro) → read-only
- Receita prevista e Valor recebido → editar no cabeçalho do show (PATCH EventFinance)
- Itens de custo → editar direto na célula (PATCH item)

### Cores
- Receita, Lucro positivo → verde (`text-green-700`, `bg-green-50`)
- Custos → vermelho (`text-red-600`)
- Saldo a receber → azul (`text-blue-600`)
- Lucro negativo → vermelho (`text-red-600`)
- Separadores de seção → fundo cinza claro (`bg-gray-100`)

### Modal "+ Adicionar show"
Duas abas:
1. **Vincular evento existente** — dropdown com Events do mês (contracted/active) ainda não vinculados
2. **Entrada avulsa** — campos: nome, data, cliente, produto contratado

### Responsividade
- Desktop: tabela horizontal com scroll
- Mobile: coluna única, um show por vez (toggle)

---

## Componentes

| Componente           | Tipo   | Responsabilidade                                 |
|----------------------|--------|--------------------------------------------------|
| `FinancasPage`       | Server | Busca dados iniciais, passa ao client            |
| `FinancasClient`     | Client | Estado do mês, orquestra tudo                    |
| `MonthSelector`      | Client | Navega entre meses/anos                          |
| `SummaryCards`       | Client | 5 cards de KPI do mês                            |
| `FinanceTable`       | Client | Tabela planilha com scroll horizontal            |
| `FinanceCell`        | Client | Célula editável (input inline on click)          |
| `AddShowModal`       | Client | Modal para adicionar show (vinculado ou avulso)  |

---

## Migração de Banco

1. Adicionar modelos `EventFinance` e `EventFinanceItem` ao `schema.prisma`
2. `prisma migrate dev --name add_finance_tables`
3. Aplicar em produção com `prisma migrate deploy`
4. Adicionar RLS: `ALTER TABLE "EventFinance" ENABLE ROW LEVEL SECURITY` e `"EventFinanceItem"` também

---

## Sidebar

Adicionar item "Finanças" com ícone `DollarSign` (Lucide) entre Documentos e Configurações no `Sidebar.tsx`.

---

## Fora do escopo (v1)

- Exportar para PDF/Excel
- Relatórios por período customizado
- Integração com sistema de pagamentos
- Alertas de vencimento
