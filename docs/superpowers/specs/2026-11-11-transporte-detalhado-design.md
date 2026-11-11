# Detalhamento de Transporte por evento — design

## Contexto

Custos do evento são linhas de `EventFinanceItem` (`category`, `label`, `amount`, `paid`). Cada evento
nasce com um item `category='transporte'`. `computeEventFinance` já soma todos os itens (inclusive vários
da mesma categoria) em `costTotal`, `costByCategory` e `cashProfit` (via `paid` por item). Só duas telas
liam apenas o primeiro item da categoria (`.find`): `EventFinanceTab` e `FinanceTable`.

## Decisões

- **Sem alteração de banco / sem migração.** Cada transporte é um `EventFinanceItem` com
  `category='transporte'`. APIs existentes (`POST/PATCH/DELETE /api/financas/[id]/items`) são reutilizadas.
- **Preservação:** o item legado vira a primeira linha do detalhamento, inalterado (nome, valor, pago).
  Total = soma dos itens → sem duplicidade; custos/lucro/margem atuais idênticos.
- **`summarizeCategory(items, category, revenue)`** em `lib/financas.ts`: `{ items, total, paidTotal,
  pendingTotal, allPaid }` — usado pelo Financeiro do evento e pelo Financeiro Geral.
- **Financeiro do evento:** a linha Transporte fica em "Outros custos", com expandir/recolher. Recolhida:
  total somente leitura + "Pago R$ X · Pendente R$ Y" + bolinha **indicadora** (não clicável; verde quando
  todos os itens com valor estão pagos). Expandida: uma linha por item (nome, valor, bolinha, lixeira),
  completada com rascunhos vazios até 3 linhas (rascunho só é gravado ao preencher nome ou valor) e
  "+ Adicionar transporte". Excluir item pago pede confirmação.
- **Financeiro Geral:** linhas padrão passam a somar todos os itens da categoria (para as demais
  categorias, com um único item, o resultado é idêntico). Cor: verde se tudo pago, vermelho se há pendente
  > 0, cinza se zerado.
- Não há auditoria financeira no sistema; nada a reutilizar.

## Fora de escopo

Demais categorias de Outros custos, cachês/músicos, recebimentos do cliente, outras bolinhas.
