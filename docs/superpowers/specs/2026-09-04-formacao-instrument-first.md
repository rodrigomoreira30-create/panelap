# Formação — Fluxo Instrumento-Primeiro com Vaga Aberta e Cachê

**Data:** 2026-09-04
**Escopo:** Aba Formação da página de evento (`/producao/[eventoId]`)

---

## Objetivo

Mudar o fluxo da aba Formação de "selecionar membro + posição juntos" para "criar vaga de instrumento primeiro, depois atribuir músico". Permitir vagas abertas (sem músico) e registrar o cachê de cada músico por evento.

---

## Mudanças no Banco de Dados

### EventMusician — alterações
- `user_id`: `String` → `String?` (nullable — vaga pode existir sem músico)
- `cache_value`: novo campo `Decimal?` (cachê do músico neste evento, opcional)

### Migration Prisma
Gerar migration: `make_user_id_nullable_add_cache_value`

---

## Fluxo de Uso

### 1. Criar vaga de instrumento
- Botão **+ Adicionar** na aba Formação
- Abre modal `InstrumentPicker`
- Instrumentos organizados por categoria:
  - **Teclas**: Acordeom, Órgão, Piano, Sintetizador, Teclado
  - **Voz**: Backing Vocal, Baixo (Voz), Barítono, Contralto, Soprano, Tenor, Vocal, Voz Feminina, Voz Masculina
  - **Cordas**: Baixo, Bandolim, Cavaquinho, Contrabaixo Acústico, Guitarra, Harpa, Ukulele, Viola, Violão, Violino, Violoncelo
  - **Percussão**: Bateria, Cajón, Percussão
  - **Sopros**: Flauta, Saxofone, Trombone, Trompete
  - **Outros**: DJ, Equipe de Som, Técnico, Time AllMusic, Time Beats, Time SB
- Seleção visual (pill/badge clicável, destaque ao selecionar)
- Botão **Adicionar** — cria `EventMusician` com `user_id = null`
- A vaga aparece como card na lista

### 2. Card de vaga
Cada `EventMusician` exibe:
- Ícone 🎵 (indigo, fundo suave)
- Nome do instrumento em destaque (azul/indigo, uppercase)
- Se `user_id == null`: texto **"Vaga aberta"** em laranja
- Se `user_id != null`: nome do músico + badge de status (Pendente/Confirmado/Recusou)
- Se `cache_value != null`: valor em cinza abaixo do nome (ex: `R$ 800,00`)
- Ícone 👤+ → abre modal `AtribuirMúsico`
- Ícone 🗑️ → remove a vaga (com confirmação)

### 3. Modal Atribuir Músico
Título: "Atribuir Músico" / Subtítulo: nome do instrumento

Conteúdo:
- Campo de busca (filtra membros por nome, client-side)
- Lista de membros da banda ainda não escalados neste evento
- Seleção de membro (clique no item)
- Campo **Valor do Cachê (R$)** (input numérico, opcional)
- Botão **Confirmar** (faz PATCH no EventMusician com user_id + cache_value)
- Botão **Cancelar**

Se a vaga já tem músico atribuído, o modal abre com o músico atual selecionado (permite trocar).

---

## Componentes

| Componente | Ação | Arquivo |
|---|---|---|
| `InstrumentPicker` | Novo | `components/producao/InstrumentPicker.tsx` |
| `AssignMusicianModal` | Novo | `components/producao/AssignMusicianModal.tsx` |
| `TeamPanel` | Reescrito | `components/producao/TeamPanel.tsx` |
| Prisma schema | Alterado | `prisma/schema.prisma` |
| Migration | Novo | `prisma/migrations/...` |
| API POST event-musicians | Atualizado | `app/api/event-musicians/route.ts` |
| API PATCH event-musicians | Novo endpoint | `app/api/event-musicians/route.ts` |

---

## APIs

### POST /api/event-musicians
Cria vaga sem músico:
```json
{ "event_id": "...", "instrument": "Vocal" }
```
`user_id` e `cache_value` opcionais.

### PATCH /api/event-musicians
Atribui músico + cachê a uma vaga existente:
```json
{ "id": "...", "user_id": "...", "cache_value": 800 }
```

### DELETE /api/event-musicians
Sem alteração (já existe).

---

## Sem Mudanças

- EventTabs, EventInfoPanel, EventDetailClient — sem alteração
- Dados de checklist, documentos, alinhamento — sem alteração
- Lógica de status (pending/confirmed/declined) — mantida

---

## Critério de Sucesso

- Criar vaga sem músico — aparece com "Vaga aberta" em laranja
- Atribuir músico a vaga — card atualiza com nome + status
- Cachê salvo e exibido no card
- Remover vaga funciona igual ao anterior
- TypeScript compila sem erros
- Prisma migration aplicada em produção
