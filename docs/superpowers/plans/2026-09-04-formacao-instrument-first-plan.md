# Plano — Formação com Fluxo Instrumento-Primeiro

**Spec:** `docs/superpowers/specs/2026-09-04-formacao-instrument-first.md`
**Data:** 2026-09-04

---

## Contexto e Padrões

### Arquivos-chave
- **Schema:** `prisma/schema.prisma` — model EventMusician
- **API:** `app/api/event-musicians/route.ts` — POST + DELETE existentes
- **TeamPanel:** `components/producao/TeamPanel.tsx` — reescrita completa
- **EventDetailClient:** `components/producao/EventDetailClient.tsx` — tipo EventMusician
- **page.tsx:** `app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx` — inclui cache_value na query

### Estado atual do model EventMusician
```prisma
model EventMusician {
  id           String                @id @default(cuid())
  event_id     String
  user_id      String                // obrigatório → vai virar String?
  instrument   String?
  status       MusicianConfirmStatus @default(pending)
  confirmed_at DateTime?
  // sem cache_value

  @@unique([event_id, user_id])     // vai ser removido
}
```

### Unique constraint atual
A API usa `upsert` com `event_id_user_id`. Com user_id nullable e múltiplas vagas por evento, o unique será removido. O upsert vira `create`.

---

## Fase 1 — Schema Prisma

### O que fazer
Editar `prisma/schema.prisma`, model `EventMusician`:

```prisma
model EventMusician {
  id           String                @id @default(cuid())
  event_id     String
  user_id      String?               // era String, vira String?
  instrument   String?
  status       MusicianConfirmStatus @default(pending)
  confirmed_at DateTime?
  cache_value  Decimal?              // novo campo

  event Event  @relation(fields: [event_id], references: [id], onDelete: Cascade)
  user  User?  @relation(fields: [user_id], references: [id], onDelete: SetNull)

  // @@unique([event_id, user_id]) — REMOVER esta linha

  @@index([event_id])
}
```

Mudanças:
1. `user_id String` → `user_id String?`
2. `cache_value Decimal?` — novo campo adicionado
3. `@@unique([event_id, user_id])` — remover
4. `user User @relation(...)` → `user User? @relation(..., onDelete: SetNull)`
5. Adicionar `@@index([event_id])` no lugar do unique

### Gerar migration
```bash
cd /Users/rodrigomoreira/Desktop/PanelAp
npx prisma migrate dev --name make_user_id_nullable_add_cache_value
```

### Aplicar em produção (via node script)
```bash
node -e "
const { Client } = require('pg');
const fs = require('fs');
// ler o SQL da migration gerada e executar
"
```
Ou usar: `npx prisma migrate deploy`

### Verificação
- [ ] Migration criada em `prisma/migrations/`
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npx prisma migrate deploy` aplicado em produção

---

## Fase 2 — API: POST e PATCH em `/api/event-musicians`

### POST — aceitar user_id opcional (criar vaga sem músico)

Mudanças em `app/api/event-musicians/route.ts`:

```typescript
// Schema de validação novo:
const addSchema = z.object({
  event_id:    z.string().cuid(),
  user_id:     z.string().cuid().optional(),  // era obrigatório
  instrument:  z.string().optional(),
  cache_value: z.number().optional(),
})
```

Remover a validação `if (!musician)` quando `user_id` for undefined.

Substituir o `upsert` por `create`:
```typescript
const em = await prisma.eventMusician.create({
  data: {
    event_id:    parsed.data.event_id,
    user_id:     parsed.data.user_id ?? null,
    instrument:  parsed.data.instrument,
    cache_value: parsed.data.cache_value ?? null,
    status:      'pending',
  },
  include: { user: { select: { id: true, name: true, avatar_url: true, schedule_token: true } } },
})
```

Enviar email apenas se `user_id` for fornecido:
```typescript
if (parsed.data.user_id && musician) {
  sendEventInviteEmail({...}).catch(...)
}
```

### PATCH — atribuir músico + cachê a vaga existente

Novo handler no mesmo arquivo:
```typescript
export async function PATCH(request: Request) {
  // validar sessão + role (admin/producer)
  // schema: { id: cuid, user_id?: cuid, cache_value?: number }
  // verificar que eventMusician pertence à banda
  // se user_id fornecido, verificar que user pertence à banda
  // atualizar: prisma.eventMusician.update({ where: { id }, data: { user_id, cache_value, status: 'pending' } })
  // enviar email se user_id for novo (era null, agora preenchido)
  // retornar eventMusician atualizado com include user
}
```

### Verificação
- [ ] POST com apenas `event_id + instrument` retorna 201 com `user_id: null`
- [ ] PATCH com `id + user_id + cache_value` atualiza corretamente
- [ ] TypeScript compila

---

## Fase 3 — Componente `InstrumentPicker.tsx`

### Criar `components/producao/InstrumentPicker.tsx`

```typescript
'use client'
// Props: onSelect(instrument: string) => void, onClose() => void

const INSTRUMENT_CATEGORIES = [
  { label: 'Teclas',    items: ['Acordeom', 'Órgão', 'Piano', 'Sintetizador', 'Teclado'] },
  { label: 'Voz',       items: ['Backing Vocal', 'Baixo (Voz)', 'Barítono', 'Contralto', 'Soprano', 'Tenor', 'Vocal', 'Voz Feminina', 'Voz Masculina'] },
  { label: 'Cordas',    items: ['Baixo', 'Bandolim', 'Cavaquinho', 'Contrabaixo Acústico', 'Guitarra', 'Harpa', 'Ukulele', 'Viola', 'Violão', 'Violino', 'Violoncelo'] },
  { label: 'Percussão', items: ['Bateria', 'Cajón', 'Percussão'] },
  { label: 'Sopros',    items: ['Flauta', 'Saxofone', 'Trombone', 'Trompete'] },
  { label: 'Outros',    items: ['DJ', 'Equipe de Som', 'Técnico', 'Time AllMusic', 'Time Beats', 'Time SB'] },
]
```

Layout: modal sobre overlay, título "Adicionar Instrumento", categorias com label cinza + pills clicáveis. Pill selecionada fica indigo com checkmark. Botões Cancelar + Adicionar (desabilitado até selecionar).

### Verificação
- [ ] Arquivo criado com `'use client'`
- [ ] Pills renderizam por categoria
- [ ] Seleção destaca o pill
- [ ] Botão Adicionar chama `onSelect` com o instrumento selecionado

---

## Fase 4 — Componente `AssignMusicianModal.tsx`

### Criar `components/producao/AssignMusicianModal.tsx`

```typescript
'use client'
// Props:
// eventMusicianId: string
// instrument: string
// currentUserId: string | null
// bandMembers: { id: string; name: string }[]
// assignedUserIds: string[]  // já escalados (para filtrar)
// onConfirm(userId: string, cacheValue: number | null) => void
// onClose() => void
```

Layout: modal com título "Atribuir Músico" + subtítulo com nome do instrumento.
- Input de busca (filtra `bandMembers` por nome, client-side)
- Lista de membros disponíveis (filtrados: não estão em `assignedUserIds` OU é o atual)
- Clique seleciona o membro (destaque visual)
- Input numérico "Valor do Cachê (R$)"
- Botão Confirmar (disabled até selecionar membro)
- Botão Cancelar

### Verificação
- [ ] Arquivo criado
- [ ] Busca filtra membros em tempo real
- [ ] Membro selecionado destaca
- [ ] Confirmar chama `onConfirm(userId, cacheValue)`

---

## Fase 5 — Reescrever `TeamPanel.tsx`

### Mudanças

**Remover:**
- Array `POSITIONS` (substituído pelas categorias do InstrumentPicker)
- Os dois selects + botão "Adicionar à equipe"
- `addMutation` com userId+position juntos

**Adicionar:**
- Estado `showInstrumentPicker: boolean`
- Estado `assigningMusician: EventMusician | null`
- Função `handleAddPosition(instrument)`: chama POST com apenas `event_id + instrument`
- Função `handleAssign(userId, cacheValue)`: chama PATCH com `id + user_id + cache_value`

**Card atualizado:**
```tsx
<div className="flex items-center gap-3 p-4 border rounded-xl bg-white shadow-sm">
  {/* ícone */}
  <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-xl">
    🎵
  </div>
  {/* info */}
  <div className="flex-1 min-w-0">
    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
      {em.instrument ?? 'Sem instrumento'}
    </p>
    {em.user ? (
      <>
        <p className="text-sm font-medium text-gray-900">{em.user.name}</p>
        {em.cache_value && (
          <p className="text-xs text-gray-400">
            R$ {Number(em.cache_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        )}
      </>
    ) : (
      <p className="text-sm font-medium text-orange-500">Vaga aberta</p>
    )}
  </div>
  {/* status badge — só se tiver músico */}
  {em.user && (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.className}`}>
      {cfg.label}
    </span>
  )}
  {/* assign button */}
  <button onClick={() => setAssigningMusician(em)} ...>
    <UserPlus size={16} />
  </button>
  {/* copy link — só se tiver músico */}
  {em.user && (
    <button onClick={() => handleCopyLink(em.user.schedule_token, em.id)} ...>
      ...
    </button>
  )}
  {/* remove */}
  <button onClick={() => removeMutation.mutate(em.id)} ...>
    <X size={16} />
  </button>
</div>
```

**Botão + Adicionar:**
```tsx
<button onClick={() => setShowInstrumentPicker(true)}
  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
  <Plus size={16} /> Adicionar instrumento
</button>
```

**Tipo EventMusician atualizado** (no EventDetailClient.tsx):
```typescript
export type EventMusician = {
  id: string
  user_id: string | null      // era string
  instrument: string | null
  status: 'pending' | 'confirmed' | 'declined'
  cache_value: number | null  // novo
  user: { id: string; name: string; avatar_url: string | null; schedule_token: string } | null  // era obrigatório
}
```

### Verificação
- [ ] InstrumentPicker abre ao clicar "+ Adicionar instrumento"
- [ ] POST cria vaga com user_id null
- [ ] Card mostra "Vaga aberta" em laranja
- [ ] 👤+ abre AssignMusicianModal
- [ ] PATCH atribui músico + cachê
- [ ] Card atualiza com nome do músico e cachê
- [ ] Remover funciona

---

## Fase 6 — Atualizar page.tsx e tipos

### `app/(dashboard)/[bandSlug]/producao/[eventoId]/page.tsx`

Adicionar `cache_value` ao select de `event_musicians`:
```typescript
event_musicians: {
  include: { user: { select: { id: true, name: true, avatar_url: true, schedule_token: true } } },
  orderBy: { id: 'asc' },
},
```

No `queryClient.setQueryData`:
```typescript
event_musicians: event.event_musicians.map(m => ({
  id: m.id,
  user_id: m.user_id,          // era m.user_id (non-null)
  instrument: m.instrument,
  status: m.status,
  cache_value: m.cache_value ? parseFloat(m.cache_value.toString()) : null,  // novo
  user: m.user,                // pode ser null agora
})),
```

### Verificação
- [ ] `npx tsc --noEmit` sem erros
- [ ] `musicianCount` no header do EventTabs ainda funciona

---

## Fase 7 — Verificação Final e Deploy

```bash
npx tsc --noEmit
```

Checklist:
- [ ] Criar vaga → aparece "Vaga aberta"
- [ ] Atribuir músico → aparece nome + status
- [ ] Cachê exibido corretamente
- [ ] Remover vaga funciona
- [ ] Header do evento mostra contagem correta
- [ ] Nenhum erro no console
- [ ] Aplicar migration em produção
- [ ] Git commit + push

---

## Ordem de Execução

```
Fase 1 (Schema) →
Fase 2 (API) →
Fase 3 (InstrumentPicker) →
Fase 4 (AssignMusicianModal) →
Fase 5 (TeamPanel reescrito) →
Fase 6 (page.tsx + tipos) →
Fase 7 (verificação + deploy)
```
