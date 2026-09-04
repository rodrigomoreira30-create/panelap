# Event Detail — Redesign com Abas

**Data:** 2026-09-03
**Escopo:** Página de detalhe do evento (`/producao/[eventoId]`)

---

## Objetivo

Reorganizar a página de detalhe do evento de layout vertical empilhado para layout com abas, seguindo a referência visual fornecida pelo usuário.

---

## Abordagem Escolhida

**Opção 1 — Refatoração cirúrgica.**
Adicionar um componente de abas como wrapper sobre os blocos que já existem. Sem reescrita de lógica de negócio, sem mudança de modelo de dados, sem risco de regressão.

---

## Layout

### Header (sempre visível, acima das abas)

Exibido em todas as abas. Contém:
- Nome do cliente (h1 bold)
- Badge de status (`contracted` / `active` / `done`)
- Tipo do evento (ex: Casamento)
- Data do evento (formato: "sáb., 17 de out. de 2026")
- Horário (ex: "20:00 - 23:00"), ou "—" se não informado
- Local do evento
- Contagem de músicos escalados (ex: "2 músicos")

O header é estático (não editável diretamente — edição continua na aba Geral). O botão "Editar" fica dentro da aba Geral, como hoje.

### Barra de Abas

Ordem: **Geral | Formação | Anexos | Financeiro | Tarefas | Chat**

Estilo: underline ativo em indigo, texto cinza inativo, hover sutil. Sem ícones (para manter clean).

---

## Conteúdo por Aba

### Geral
Conteúdo atual mantido integralmente:
- `EventInfoPanel` — campos do evento (local, endereço, horário, som/luz, assessora, valor da proposta)
- `EventAttractionsEditor` — atrações/proposta do lead
- `ChecklistPanel` — checklists operacionais
- `EventAlignmentNotes` — alinhamento/notas do evento

### Formação
Conteúdo: `TeamPanel` — equipe escalada.

Mudança visual: os músicos são exibidos como **cards** em vez de lista plana. Cada card mostra:
- Ícone do instrumento (emoji, como hoje)
- Nome do instrumento (posição)
- Avatar inicial + nome do músico, ou "Vaga aberta" em laranja se não atribuído ainda
- Badge de status (Pendente / Confirmado / Recusou)
- Ícones de ação: copiar link, remover

O formulário de adicionar (select membro + select posição + botão) é mantido no final da aba, igual ao fluxo atual.

As "Observações Equipe Escalada" permanecem no final da aba Formação.

### Anexos
Conteúdo: `EventDocuments` — upload e listagem de documentos, igual ao que existe hoje.

### Financeiro
Placeholder: mensagem "Em breve" + ícone.

### Tarefas
Placeholder: mensagem "Em breve" + ícone.

### Chat
Placeholder: mensagem "Em breve" + ícone.

---

## Componentes Afetados

| Componente | Mudança |
|---|---|
| `app/.../producao/[eventoId]/page.tsx` | Refatorado para usar novo `EventTabs` |
| `components/producao/EventTabs.tsx` | **Novo** — header + barra de abas + conteúdo por aba |
| `components/producao/TeamPanel.tsx` | Visual dos músicos alterado para cards |
| Demais componentes | Sem alteração |

---

## Sem Mudanças

- Modelo de dados (Prisma schema) — sem alteração
- APIs (`/api/events`, `/api/event-musicians`) — sem alteração
- Lógica de negócio do TeamPanel — sem alteração
- Componentes: `EventInfoPanel`, `EventAttractionsEditor`, `ChecklistPanel`, `EventAlignmentNotes`, `EventDocuments` — sem alteração

---

## Critério de Sucesso

- Página carrega com header visível e aba "Geral" ativa por padrão
- Trocar de aba não causa re-fetch desnecessário
- Aba Formação mostra os músicos em cards com visual atualizado
- Todos os campos e funcionalidades existentes continuam operando normalmente
