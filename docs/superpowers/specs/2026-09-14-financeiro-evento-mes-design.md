# Financeiro por Evento + Consolidação Mensal — Design Spec
**Data:** 2026-09-14
**Status:** Aprovado

---

## Objetivo

Fazer o evento (`Event`) ser a única fonte de verdade dos dados financeiros. A tela mensal
"Finanças" deixa de aceitar lançamentos soltos e passa a ser apenas uma visão agregada e
somente-leitura sobre o financeiro de cada evento do mês.

Este design é uma **evolução incremental** do módulo `EventFinance`/`EventFinanceItem` já
existente (não uma reescrita para o modelo `RevenueItem`/`Payment`/`CostItem` mais amplo
descrito no prompt original do usuário — ver "Fora de escopo").

---

## Contexto atual (o que já existe)

- `EventFinance` já é 1:1 com `Event`, mas `event_id` é opcional (`String? @unique`). A tela
  mensal permite criar uma "Entrada avulsa" sem vínculo a evento (`AddShowModal.tsx`, aba
  "Entrada avulsa" → `POST /api/financas` sem `event_id`).
- `expected_revenue` e `received_amount` são campos únicos digitados manualmente no
  `EventFinance`, não derivados de nenhuma lista de itens.
- Custos ficam em `EventFinanceItem` (categoria + label + valor + pago), criados a partir de
  `DEFAULT_FINANCE_ITEMS` (`lib/financas.ts`), que hoje inclui tanto custos administrativos
  (Pró-labore, Comissão Panel, Nota fiscal...) quanto categorias fixas por instrumento
  (`cantor_1`, `guitarrista`, `baterista`...) preenchidas manualmente, sem ligação com quem
  está de fato escalado na aba Formação (`EventMusician`).
- Dinheiro é armazenado como `Decimal` (Postgres `numeric`) em todo o sistema — não em centavos.
- Levantamento no banco de produção (14/09/2026): **0 registros `EventFinance` com `event_id`
  nulo** — não há hoje passivo de dados órfãos para migrar.

---

## Regras de negócio

1. **Single source of truth**: todo valor financeiro nasce no evento. A tela mensal não edita
   nada, apenas agrega.
2. **Agrupamento mensal** pela `event.event_date` (fuso `America/Sao_Paulo`), sem filtro de
   status — todo evento com data no mês entra na planilha.
3. **Totais sempre derivados** por uma única função de cálculo, nunca digitados na tela mensal.
4. **Cachê de músico é um custo**: ao escalar um profissional na Formação com `cache_value`
   preenchido, cria-se automaticamente uma linha de custo (`category = cache_musico`) vinculada
   àquele `EventMusician`. Remover o músico da Formação remove (ou bloqueia, se já pago) a linha
   de custo correspondente.
5. **Comissões e impostos percentuais** (Comissão Panel, Comissão vendedor, Nota fiscal) podem
   ser definidos como `% da receita prevista`, calculados automaticamente, mas sempre editáveis
   — editar manualmente marca `is_overridden = true` e trava o recálculo automático até o
   usuário desmarcar.
6. **Dinheiro continua em `Decimal`** — não migrar para centavos/`Int` nesta entrega (mudança
   de escopo maior, tocaria `Event.value`, `EventMusician.cache_value` e outras tabelas fora
   deste módulo).

---

## Modelo de dados

### `EventFinance` (alteração)

| Campo      | Antes            | Depois           | Motivo                                    |
|------------|------------------|-------------------|--------------------------------------------|
| `event_id` | `String? @unique`| `String @unique`  | Vínculo a evento passa a ser obrigatório  |

A relação `Event? @relation(..., onDelete: SetNull)` em `EventFinance.event` passa a
`Event @relation(..., onDelete: Cascade)` — coerente com o restante do schema (Contract,
Checklist, EventMusician já usam `Cascade` a partir de `Event`).

### `EventFinanceItem` (novas colunas)

| Campo               | Tipo                  | Notas                                                        |
|---------------------|-----------------------|---------------------------------------------------------------|
| `percent_of_revenue`| `Decimal? @db.Decimal(5,2)` | Se preenchido, `amount` é recalculado a partir de `expected_revenue` |
| `is_overridden`     | `Boolean @default(false)` | Trava o recálculo automático quando o usuário edita `amount` na mão |
| `event_musician_id` | `String?`             | FK opcional para `EventMusician`, `onDelete: SetNull`         |

### `DEFAULT_FINANCE_ITEMS` (`lib/financas.ts`)

Remove as categorias fixas de instrumento (`cantor_1..4`, `guitarrista`, `baixista`,
`baterista`, `tecladista`, `percussao`, `sanfoneiro`, `dj`, `tecnico_som`, `tecnico_luz`).
Essas linhas passam a ser geradas dinamicamente (ver próxima seção). Mantém as categorias
administrativas: `pro_labore`, `comissao_panel`, `comissao_vendedor`, `nota_fiscal`,
`visita_tecnica`, `bv_cerimonial`, `alimentacao_extra`, `transporte`, `hospedagem`, `outros`.

Nova categoria lógica `cache_musico` — não entra em `DEFAULT_FINANCE_ITEMS` (não é pré-criada
na abertura do evento); é criada/removida pela sincronização com a Formação.

---

## Sincronização Formação ↔ Financeiro

Ponto único: `POST`/`PATCH`/`DELETE` em `app/api/event-musicians/route.ts`, que já concentram
toda criação/atualização/remoção de `EventMusician`.

- **Criar/atualizar `EventMusician` com `cache_value` preenchido** → `upsert` de um
  `EventFinanceItem` com `category = 'cache_musico'`, `event_musician_id` = id do músico,
  `label` = nome do instrumento/função, `amount` = `cache_value`.
- **`cache_value` fica vazio/nulo** → remove o `EventFinanceItem` vinculado (se não estiver pago).
- **Remover `EventMusician`** →
  - Se o `EventFinanceItem` vinculado não está pago (`paid = false`): remove automaticamente.
  - Se está pago (`paid = true`): a API retorna `409 Conflict` com mensagem explicando o
    conflito; a remoção só é efetivada se o cliente reenviar com uma flag de confirmação
    explícita (`?force=true` ou corpo `{ confirm: true }`), e a UI deve mostrar um diálogo de
    confirmação antes de reenviar.

---

## Camada de cálculo (`lib/financas.ts`)

Função central `computeEventFinance(finance: EventFinanceData)`, usada tanto pela aba do
evento quanto pela tela mensal — nenhum componente React soma dinheiro diretamente.

```ts
computeEventFinance(finance) => {
  revenueForecast: number        // finance.expected_revenue
  received: number               // finance.received_amount
  receivable: number             // revenueForecast - received
  costTotal: number              // Σ items.amount (usando valor já recalculado se percentual)
  costByCategory: Record<string, number>
  profit: number                 // revenueForecast - costTotal
  marginPercent: number | null   // null (exibir "—") se revenueForecast === 0
  cashProfit: number             // received - Σ items pagos
}
```

Regras de borda:
- `revenueForecast === 0` → `marginPercent = null`, UI exibe "—" (nunca `NaN`/`Infinity`).
- `profit < 0` → sinalizado para a UI exibir em vermelho com sinal negativo.
- Item com `percent_of_revenue` preenchido e `is_overridden = false` → `amount` recalculado
  como `revenueForecast * percent_of_revenue / 100` a cada chamada (não persistido como
  verdade; o valor salvo em `amount` é só um cache, recalculado no service a cada leitura/mutação).
- `received > revenueForecast` → não bloquear; `receivable` fica negativo e a UI sinaliza
  "recebido acima do previsto".

**Testes unitários** (Vitest, já usado no repo — `npm run test`): evento sem nada, evento só
com receita, item percentual, item com override, lucro negativo, recebido acima do previsto,
arredondamento de `Decimal`.

---

## API

| Rota                                             | Mudança                                                        |
|---------------------------------------------------|------------------------------------------------------------------|
| `POST /api/financas`                              | `event_id` passa a ser obrigatório; remove o caminho de criação sem evento (erro 422 se ausente) |
| `PATCH /api/financas/[id]/items/[itemId]`          | Aceita `percent_of_revenue`; grava `is_overridden = true` quando `amount` é editado manualmente; `is_overridden = false` quando o usuário volta a editar `percent_of_revenue` |
| `POST`/`PATCH`/`DELETE /api/event-musicians`       | Passam a sincronizar o `EventFinanceItem` de `category = cache_musico` (criar/atualizar/remover); `DELETE` verifica se o item vinculado já está pago e retorna 409 pedindo confirmação nesse caso |
| `GET /api/financas` (mensal)                       | Passa a usar `computeEventFinance` para montar os totais, em vez de somar campos soltos |

Validação de entrada com Zod (já usado no projeto), seguindo o padrão existente nas rotas de
`financas` e `event-musicians`.

---

## UI — aba "Financeiro" do evento

Substitui o placeholder atual (`PlaceholderTab` em `EventTabs.tsx`, tab `financeiro`).

1. **5 cards de resumo**: Receita prevista · Recebido · A receber · Custos · Lucro/Margem —
   mesmo visual dos cards já usados em `components/financas/SummaryCards.tsx`.
2. **Bloco Receita**: campos únicos `expected_revenue` / `received_amount` (mantém o modelo
   atual, sem quebrar em itens de receita — fora de escopo nesta entrega).
3. **Bloco Custos**:
   - Subseção **Equipe/Cachês**: lista dinâmica vinda da Formação (itens `cache_musico`),
     somente leitura quanto a *quem* está na lista (isso é gerenciado na aba Formação); o valor
     do cachê é editável aqui e reflete de volta.
   - Subseção **Outros custos**: uma linha por categoria administrativa restante, com campo de
     valor, campo opcional de `%` (com toggle override) e toggle "pago".
4. **Rodapé "Resultado do evento"**: Receita prevista − Custos = Lucro (com margem), e a visão
   de caixa (Recebido − Custos pagos).

Comportamento: autosave com debounce (~600ms) + indicador "Salvo", máscara de moeda pt-BR,
estados de vazio/loading/erro por bloco.

---

## UI — tela "Finanças" (mensal), somente-leitura

- Continua buscando por `event_date` dentro do mês (como hoje), sem filtro de status.
- Matriz: colunas = eventos do mês, linhas = categorias (usando `costByCategory` de
  `computeEventFinance`), última coluna = Total do mês.
- Células não são mais editáveis — clique abre `/producao/eventos/[id]?tab=financeiro`.
- **`AddShowModal`**: remove a aba "Entrada avulsa". Mantém apenas "Vincular evento", listando
  eventos do mês que ainda não têm `EventFinance`.
- Ícone de lixeira do cabeçalho da coluna deixa de apagar dados financeiros soltos — vira
  "desvincular"/remover o `EventFinance` do evento (não o evento em si), com confirmação.

---

## Migração

Script idempotente (`scripts/migrate-orphan-finance.ts` ou similar), dry-run por padrão
(`--apply` para efetivar):

1. Busca todo `EventFinance` com `event_id = null`.
2. Para cada um, cria um `Event` retroativo (status `done`) com os dados básicos disponíveis
   (`name`/`client` → `client_name`, `event_date`, `expected_revenue` → `value`) e vincula o
   `EventFinance` a ele.
3. Imprime relatório antes/depois comparando totais do mês — precisam bater exatamente.

Como o levantamento de 14/09/2026 encontrou **zero** registros órfãos, este script funciona
como rede de segurança (protege contra dados que venham a ser inseridos entre o design e a
implementação, ou de importações futuras) — não é esperado que ele precise mover dados hoje.
Antes de aplicar a migração de schema (tornar `event_id` obrigatório), a implementação deve
rodar este script em dry-run contra produção para confirmar que a contagem de órfãos continua
zero.

---

## Fora de escopo (explicitamente adiado)

- Quebrar receita em itens (`RevenueItem`) e parcelas de pagamento (`Payment`) — hoje
  `expected_revenue`/`received_amount` continuam como campos únicos.
- Migração de `Decimal` para centavos (`Int`) em qualquer tabela do sistema.
- Toggle "Competência × Caixa" na agregação mensal (hoje agrupa só por `event_date`, regime de
  competência).
- Exportação CSV/XLSX da planilha mensal.
- Diferenciar eventos "em negociação" em uma coluna separada — todo evento com data no mês
  entra igualmente na planilha.

---

## Critérios de aceite

- [ ] `event_id` obrigatório em `EventFinance`; não é mais possível criar registro financeiro
      sem evento pela API nem pela UI.
- [ ] Escalar um músico na Formação com cachê cria automaticamente a linha de custo
      correspondente no financeiro do evento; removê-lo remove a linha (ou bloqueia com
      confirmação se já paga).
- [ ] Comissão Panel/vendedor/Nota fiscal calculam por `%` da receita prevista e permitem
      override manual, travando o recálculo até ser destravado.
- [ ] A aba "Financeiro" do evento mostra os 5 cards batendo com o rodapé "Resultado do evento".
- [ ] A tela mensal mostra os mesmos números do evento, sem nenhuma célula editável.
- [ ] Modal de adição da tela mensal só permite vincular evento existente.
- [ ] Testes de `computeEventFinance` cobrindo os casos de borda listados.
- [ ] Script de migração roda em dry-run sem apontar órfãos (baseline: zero em 14/09/2026).
