# TanStack Query — Integração no Kanban de Leads

**Data:** 2026-05-30  
**Escopo:** Módulo Comercial (Kanban de leads)  
**Abordagem:** Híbrido SSR + cache (HydrationBoundary)

---

## Objetivo

Integrar o TanStack Query no Kanban de leads para que o board atualize automaticamente após ações do usuário (mover card, criar lead) sem recarregar a página, mantendo o benefício de carregamento rápido via SSR do Next.js 14.

---

## Arquitetura

### Novos arquivos

- `lib/query-client.ts` — factory do QueryClient com configurações padrão (staleTime, retry)
- `components/shared/QueryProvider.tsx` — Client Component que envolve o app com `QueryClientProvider`

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `app/(dashboard)/[bandSlug]/layout.tsx` | Adiciona `<QueryProvider>` envolvendo o conteúdo |
| `app/(dashboard)/[bandSlug]/comercial/page.tsx` | Adiciona `dehydrate` + `<HydrationBoundary>` |
| `components/comercial/KanbanBoard.tsx` | Substitui `initialLeads` por `useQuery(['leads', bandSlug])` |
| `components/comercial/KanbanColumn.tsx` | Adiciona `useMutation` para PATCH de status ao mover card |
| `components/comercial/NewLeadButton.tsx` | Adiciona `useMutation` para POST de lead, invalida cache ao sucesso |

---

## Fluxo de dados

### Primeira carga (SSR)
1. `page.tsx` busca leads via Prisma no servidor
2. Dados são desidratados com `dehydrate(queryClient)` e enviados ao cliente via `HydrationBoundary`
3. Browser recebe HTML pronto + cache pré-populado
4. `KanbanBoard` lê do cache local — sem fetch adicional

### Mover card
1. Usuário arrasta card para nova coluna
2. `KanbanColumn` dispara mutation: `PATCH /api/leads/:id { status: 'novo_status' }`
3. Servidor atualiza banco → responde 200
4. `onSuccess`: `queryClient.invalidateQueries(['leads', bandSlug])`
5. `useQuery` rebusca `GET /api/leads` automaticamente
6. Kanban re-renderiza com dados atualizados

### Criar lead
1. Formulário enviado → `POST /api/leads`
2. `onSuccess`: `queryClient.invalidateQueries(['leads', bandSlug])`
3. Kanban atualiza mostrando o novo card

---

## Chave de query

```
['leads', bandSlug]
```

Escopo por banda para evitar conflito entre tenants.

---

## Tratamento de erros

- **Mutation com falha:** card não muda de coluna, estado local revertido, toast com mensagem de erro
- **Query com falha:** exibe mensagem de erro com botão "Tentar novamente"
- **Loading após mutation:** Kanban mantém dados anteriores visíveis enquanto rebusca (sem tela em branco)

---

## Fora do escopo (próximas iterações)

- Polling automático (intervalo fixo)
- Integração com Agenda e Contratos
- Atualização otimista (card move antes da confirmação do servidor)
- WebSocket / real-time para múltiplos usuários simultâneos
