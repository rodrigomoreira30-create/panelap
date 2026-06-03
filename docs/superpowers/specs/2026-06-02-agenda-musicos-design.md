# Agenda dos Músicos — Design

**Data:** 2026-06-02

## Objetivo

Permitir que cada músico visualize sua agenda de shows, tanto por uma página pública (sem login) quanto exportando para Google Calendar / Apple Calendar via arquivo `.ics`.

## Contexto

O sistema já possui:
- Modelo `EventMusician` com `status` (pending/confirmed/declined) e endpoint de confirmar/recusar por evento
- Role `musician` no modelo `User`
- Painel "Equipe Escalada" no módulo de Produção (TeamPanel) para adicionar músicos a eventos

Músicos podem ser internos (têm login no app) ou externos (recebem links por WhatsApp/email). A solução cobre ambos sem exigir login.

## Arquitetura

### Novo campo no banco

```prisma
model User {
  // campo adicionado:
  schedule_token String @unique @default(cuid())
}
```

Token gerado automaticamente ao criar o usuário. Permanente e único — identifica o músico de forma segura sem expor o ID interno. Admin compartilha o link com o músico via WhatsApp/email.

### Novos arquivos

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `app/musico/[token]/page.tsx` | Server component | Página pública de agenda do músico |
| `app/musico/[token]/layout.tsx` | Layout | Layout simples, sem navbar do dashboard |
| `app/api/ics/[token]/route.ts` | API Route | Gera e retorna arquivo `.ics` |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | Adiciona `schedule_token` ao modelo `User` |
| `components/producao/TeamPanel.tsx` | Adiciona botão "Copiar link" por músico |
| `components/producao/EventDetailClient.tsx` | Inclui `schedule_token` no select do user |

## Página pública — `/musico/[token]`

- **Acesso:** público, sem autenticação
- **Layout:** fora do `(dashboard)` — layout próprio minimalista, mobile-first
- **Conteúdo:**
  - Nome do músico no topo
  - Lista de eventos **futuros** onde está escalado, ordenados por data crescente
  - Por evento: data formatada, nome do cliente, tipo de evento, local + cidade, badge de status (Pendente / Confirmado / Recusou)
  - Botões "Confirmar" e "Recusar" por evento (visíveis só quando status = pending) — linkam para o endpoint existente `/api/musicians/[eventMusicianId]/confirm?action=confirm`
  - Botão "Exportar para Google Calendar" → `GET /api/ics/[token]`
  - Mensagem "Nenhum show agendado por enquanto." quando lista vazia
  - Retorna 404 (notFound) se o token não existir no banco

## Endpoint ICS — `GET /api/ics/[token]`

- **Acesso:** público, sem autenticação
- **Retorno:** `Content-Type: text/calendar`, `Content-Disposition: attachment; filename="minha-agenda.ics"`
- **Token inválido:** retorna 404
- **Formato ICS:** padrão RFC 5545 com:
  - `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//PanelAp//Agenda//PT`
  - Por evento:
    - `SUMMARY`: `{client_name} - {event_type}`
    - `DTSTART`: data do evento (formato `YYYYMMDD`)
    - `LOCATION`: `{venue_name}, {city}` (quando disponível)
    - `DESCRIPTION`: `Status: {Confirmado|Pendente|Recusou}`
    - `UID`: `{event_musician_id}@panelap`

## Integração no TeamPanel

- Cada item da lista de músicos escalados ganha ícone de link (ex: `<Link2 size={14} />`)
- Ao clicar: copia `{origin}/musico/{user.schedule_token}` para o clipboard
- Feedback visual: ícone vira checkmark por 2 segundos
- O campo `schedule_token` é incluído no `select` do `user` nas queries de `EventMusician`

## Fluxo completo

1. Admin adiciona músico à equipe do evento (já funciona)
2. Admin clica em "Copiar link" no card do músico → link copiado
3. Admin envia link por WhatsApp/email ao músico
4. Músico acessa o link → vê todos os shows futuros
5. Músico confirma/recusa presença por evento (links individuais)
6. Músico clica "Exportar para Google Calendar" → importa `.ics` na agenda

## O que não está no escopo

- Assinatura webcal live (atualização automática na agenda do músico)
- Notificações automáticas por WhatsApp/email ao escalar músico
- Página "Minha Agenda" dentro do app autenticado (desnecessário — link público cobre o caso)
- Regeneração manual do token
