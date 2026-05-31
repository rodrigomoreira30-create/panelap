# TanStack Query — Página de Detalhe do Evento (Produção)

**Data:** 2026-05-31
**Escopo:** Página `/producao/[eventoId]` — seções de Checklist e Equipe
**Abordagem:** Híbrido SSR + cache (HydrationBoundary), query única por evento

---

## Objetivo

Integrar TanStack Query na página de detalhe do evento para que:
1. Marcar um item de checklist atualize o contador "X/Y (%)" em tempo real
2. Adicionar/remover músico atualize a lista sem recarregar a página (eliminar `router.refresh()`)

---

## Arquitetura

### Novos arquivos

- `components/producao/EventDetailClient.tsx` — Client Component que usa `useQuery(['event', eventoId])` e renderiza ChecklistPanel + TeamPanel com dados do cache

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx` | Adiciona `prefetchQuery` + `HydrationBoundary`; extrai seções dinâmicas para `EventDetailClient` |
| `components/producao/ChecklistPanel.tsx` | Recebe `eventoId` como prop e repassa para `ChecklistItemRow` |
| `components/producao/ChecklistItemRow.tsx` | Adiciona `eventoId`; usa `useMutation` + invalida `['event', eventoId]` |
| `components/producao/TeamPanel.tsx` | Substitui `useState` + `router.refresh()` por `useMutation` + `invalidateQueries` |

### API

`GET /api/events/[id]` — já existe e retorna evento com checklists, itens e músicos. Nenhuma mudança necessária.

---

## Estrutura da página após a mudança

```
page.tsx (Server Component)
  ├── Header do evento (estático — continua server-rendered)
  ├── Grid de informações (estático)
  ├── Observações (estático)
  └── HydrationBoundary
       └── EventDetailClient (Client Component)
            ├── useQuery(['event', eventoId]) → dados dinâmicos
            ├── ChecklistPanel ← event.checklists + eventoId
            │    └── ChecklistItemRow ← item + eventoId
            └── TeamPanel ← event.event_musicians + bandMembers + eventoId
```

---

## Fluxo de dados

### Primeira carga

1. `page.tsx` chama `queryClient.prefetchQuery(['event', eventoId])` via Prisma
2. Dados desidratados com `dehydrate` e enviados ao cliente via `HydrationBoundary`
3. `EventDetailClient.useQuery` lê do cache local — sem fetch adicional

### Marcar item de checklist

1. `ChecklistItemRow` dispara `useMutation`
2. `onMutate`: atualiza cache local (item marcado imediatamente)
3. `PATCH /api/checklists/:checklistId/items` — servidor persiste
4. `onError`: reverte cache ao estado anterior
5. `onSettled`: `invalidateQueries(['event', eventoId])` → refetch → contador atualiza

### Adicionar músico

1. `TeamPanel` dispara `useMutation`
2. `POST /api/event-musicians`
3. `onSuccess`: `invalidateQueries(['event', eventoId])` → músico aparece na lista

### Remover músico

1. `TeamPanel` dispara `useMutation`
2. `onMutate`: remove músico do cache (some na hora)
3. `DELETE /api/event-musicians?id=...`
4. `onError`: reverte cache
5. `onSettled`: `invalidateQueries(['event', eventoId])`

---

## Chave de query

```
['event', eventoId]
```

---

## Tipos

O `GET /api/events/[id]` serializa `Decimal` e `Date` como strings via JSON. O client `queryFn` recebe os dados já como strings — sem transformação adicional necessária (ao contrário do Kanban que precisava converter `budget`).

`bandMembers` são buscados no servidor e passados como prop estático para `EventDetailClient` — não mudam durante a sessão de edição do evento.

---

## Tratamento de erros

- **Marcar item falha:** checkbox reverte ao estado anterior automaticamente
- **Adicionar músico falha:** botão retorna ao estado normal, músico não aparece
- **Remover músico falha:** músico volta a aparecer na lista
- **Query falha:** `EventDetailClient` exibe mensagem de erro com botão "Tentar novamente"

---

## Fora do escopo

- Lista de eventos `/producao` (sem mutações frequentes, baixo ganho)
- Edição do status do evento
- Upload de documentos do evento
