# PanelAp — Design Spec
**Data:** 2026-05-25  
**Status:** Aprovado para planejamento  
**Versão:** 1.0

---

## 1. Visão Geral

PanelAp é um SaaS multi-tenant de gestão operacional para bandas e artistas. Substitui o ecossistema fragmentado (CRM Como + Google Docs + DocSign/ZapSign + Trello + Google Sheets) por uma plataforma única onde o dado nasce uma vez e propaga automaticamente por todos os módulos.

**Público-alvo:** Bandas e artistas que fazem eventos ao vivo (shows, casamentos, festas corporativas).  
**Modelo de negócio:** Assinatura mensal por banda (SaaS), billing via Asaas (PIX, boleto, cartão).  
**Escopo:** Multi-band — cada banda é um tenant isolado.

---

## 2. Arquitetura

### Padrão
Monolito Modular — uma única aplicação Next.js com domínios bem separados. Cada módulo tem sua própria camada de dados e lógica de negócio, comunicando-se através de eventos internos.

### Stack
| Camada | Tecnologia |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Banco de dados | PostgreSQL + Prisma ORM |
| Auth + Storage | Supabase (Auth com RLS + Storage) |
| Agentes de IA | Claude API (claude-sonnet-4-6) |
| Assinatura digital | ZapSign API |
| Billing | Asaas API |
| UI | Tailwind CSS + shadcn/ui |
| Deploy | Vercel |

### Multi-tenancy
Isolamento via Row Level Security (RLS) no PostgreSQL. Cada registro pertence a uma `band_id`. Supabase Auth emite tokens com `band_id` no claim, e as políticas RLS garantem que nenhuma banda acesse dados de outra.

---

## 3. Módulos

### 3.1 Módulo Comercial
CRM completo integrado ao WhatsApp.

**Funcionalidades:**
- Pipeline Kanban com estágios configuráveis: Novo Lead → Em Atendimento → Proposta Enviada → Negociação → Fechado → Perdido
- Histórico completo de conversas por lead
- Integração WhatsApp (recebimento e envio de mensagens)
- Envio de propostas
- Follow-up automatizado
- Visualização de todos os leads por estágio

**Campos do Lead:**
- Nome e telefone do cliente
- Tipo de evento (casamento, festa, show, corporativo, etc.)
- Data e horário pretendidos
- Cidade e nome do local
- Local possui estrutura de som? (sim/não)
- Local possui estrutura de luz? (sim/não)
- Orçamento estimado
- Observações
- Responsável pelo atendimento

### 3.2 Módulo de Contratos
Geração automática com revisão humana obrigatória antes do envio.

**Funcionalidades:**
- Templates de contrato com variáveis dinâmicas (`{{client_name}}`, `{{event_date}}`, `{{value}}`, etc.)
- Preenchimento automático com dados do lead/evento ao fechar negócio
- Notificação ao responsável para revisão do contrato gerado
- Aprovação manual antes do envio
- Envio para ZapSign via API após aprovação
- Envio automático do link de assinatura ao cliente via WhatsApp
- Webhook do ZapSign atualiza status automaticamente quando assinado
- PDF assinado salvo automaticamente em Documentos

**Status do contrato:** `draft` → `pending_review` → `sent` → `signed`

### 3.3 Módulo de Produção
Gestão operacional do evento após fechamento.

**Funcionalidades:**
- Card do evento criado automaticamente ao fechar lead
- Informações herdadas do Lead/Event (cliente, data, local, estrutura, valores)
- Checklists operacionais gerados automaticamente (personalizáveis por tipo de evento)
- Demandas técnicas (rider de som, luz, palco)
- Gestão de equipe por evento
- Visita técnica: campo de data aguarda informação do contratante — não é agendado automaticamente
- Comentários internos da equipe
- Notificação para equipe de produção ao criar card

### 3.4 Módulo de Agenda
Calendário centralizado dos músicos.

**Funcionalidades:**
- Visão de calendário com todos os eventos da banda
- Bloqueio automático de data ao criar evento
- Detecção de conflitos de agenda
- Escala de músicos por evento (quais músicos participam)
- Confirmação de presença com 1 clique pelo músico
- Alerta automático para eventos sem confirmação
- Notificação push/WhatsApp para cada músico escalado

### 3.5 Módulo de Documentos
Central de arquivos do evento e da banda.

**Funcionalidades:**
- Organização por evento e por tipo (contrato, rider, briefing, mapa, outro)
- Upload manual e automático (contratos assinados salvos pelo sistema)
- Acesso por permissão de role
- Download e visualização inline de PDFs

### 3.6 Módulo de Agentes IA
Camada de automação e inteligência. Detalhado na Seção 4.

---

## 4. Agentes de IA

Todos os agentes utilizam a Claude API com acesso ao contexto completo do evento/lead.

### Agente 1 — SDR / Atendimento Comercial
**Gatilho:** Novo lead entra pelo WhatsApp  
**Responsabilidades:**
- Responder dúvidas sobre a banda e serviços
- Coletar: data, tipo de evento, local, cidade, orçamento
- Coletar: o local já possui estrutura de som? E de luz? (determina composição da proposta)
- Gerar e enviar proposta adequada ao perfil
- Fazer follow-up automático após 24h sem resposta
- Escalar para atendimento humano quando solicitado ou em situações complexas
- Alimentar campos do Lead no CRM durante a conversa

**Saída:** Lead qualificado com todos os campos preenchidos + proposta enviada

---

### Agente 2 — Contratos
**Gatilho:** Lead marcado como "Fechado" no pipeline  
**Responsabilidades:**
- Ler todos os dados da negociação no CRM
- Selecionar template de contrato adequado
- Preencher todas as variáveis com dados do lead/evento
- Gerar PDF do contrato
- Notificar responsável para revisão (não envia sem aprovação humana)
- Após aprovação: enviar para ZapSign via API
- Enviar link de assinatura ao cliente via WhatsApp

**Regra crítica:** O contrato nunca é enviado ao cliente sem revisão e aprovação manual do responsável.

**Saída:** Contrato no status `pending_review` aguardando aprovação

---

### Agente 3 — Produção
**Gatilho:** Lead marcado como "Fechado" no pipeline  
**Responsabilidades:**
- Criar card do evento no módulo de Produção com dados herdados do Lead
- Gerar checklist operacional padrão para o tipo de evento
- Adicionar demandas técnicas baseadas no rider da banda
- Notificar equipe de produção
- Registrar campo de visita técnica como pendente (aguarda data informada pelo contratante)
- Atualizar card quando contratante informar data da visita técnica

**Saída:** Card de produção completo, visita técnica pendente de data

---

### Agente 4 — Agenda
**Gatilho:** Evento criado no módulo de Produção  
**Responsabilidades:**
- Verificar conflitos de agenda na data do evento
- Bloquear data para músicos da escala padrão
- Enviar notificação de confirmação para cada músico
- Coletar confirmação de presença
- Alertar responsável se músico não confirmar em 48h

**Saída:** Escala do evento com status de confirmação por músico

---

### Agente 5 — Pós-venda
**Três gatilhos independentes:**

**Gatilho 1 — Contrato assinado:**
- Enviar mensagem de boas-vindas ao cliente

**Gatilho 2 — 20 dias antes do evento:**
- Contatar cliente para marcar reunião de alinhamento
- Confirmar horário e local do evento
- Solicitar cronograma do evento
- Confirmar se será necessária visita técnica

**Gatilho 3 — 24h após o evento:**
- Enviar pesquisa de satisfação
- Solicitar depoimento e/ou foto do evento

---

## 5. Fluxo Central de Dados

```
WhatsApp → Lead (Comercial)
              ↓ [status = FECHADO]
         ┌────┴─────────────────────┐
         ↓                         ↓
    Contract (draft)          Event (created)
    → notify for review        ↓           ↓
    → pending_review      Checklist   EventMusician
    → [approved] → ZapSign   (auto)     (auto + notify)
    → [signed] → Document
```

**Princípio:** Um dado de origem, propagação automática para todos os módulos.

---

## 6. Estrutura de Dados (Entidades Principais)

### Band (tenant root)
```
id, name, slug, plan, logo_url, created_at
```

### User
```
id, band_id, name, email, role (admin|commercial|producer|musician), phone, avatar_url
```

### Lead
```
id, band_id, client_name, phone, event_type, event_date, city,
venue_name, venue_has_sound (bool), venue_has_light (bool),
budget, status (pipeline stage), assigned_to, created_at
```

### Event
```
id, band_id, lead_id, client_name, event_type, event_date, event_time,
venue_name, venue_address, venue_has_sound, venue_has_light,
value, status (contracted|active|done),
technical_visit_date (nullable), notes
```

### Contract
```
id, event_id, template_id, pdf_url,
zapsign_doc_id, zapsign_link,
status (draft|pending_review|sent|signed),
reviewed_by, signed_at, created_at
```

### ContractTemplate
```
id, band_id, name, content (com variáveis {{...}}), is_default, created_at
```

### Checklist
```
id, event_id, title, assigned_to
```

### ChecklistItem
```
id, checklist_id, description, done, due_date
```

### EventMusician
```
id, event_id, user_id, instrument,
status (pending|confirmed|declined), confirmed_at
```

### Document
```
id, band_id, event_id (nullable), type (contract|rider|briefing|map|other),
file_url, uploaded_by, created_at
```

### Message
```
id, lead_id, direction (in|out), content,
sent_by (agent|human), sent_at
```

---

## 7. Permissões por Role

| Ação | Admin | Commercial | Producer | Musician |
|---|---|---|---|---|
| Ver/editar leads | ✅ | ✅ | ❌ | ❌ |
| Aprovar contratos | ✅ | ✅ | ❌ | ❌ |
| Ver produção | ✅ | ✅ | ✅ | ❌ |
| Editar checklists | ✅ | ❌ | ✅ | ❌ |
| Ver agenda | ✅ | ✅ | ✅ | ✅ |
| Confirmar presença | ✅ | ❌ | ❌ | ✅ |
| Ver documentos | ✅ | ✅ | ✅ | ❌ |
| Gerenciar membros | ✅ | ❌ | ❌ | ❌ |
| Configurar billing | ✅ | ❌ | ❌ | ❌ |

---

## 8. Integrações Externas

| Integração | Uso | Método |
|---|---|---|
| WhatsApp | Receber/enviar mensagens de leads | API (webhook) |
| ZapSign | Assinatura digital de contratos | REST API + webhook |
| Asaas | Billing/assinatura do SaaS | REST API + webhook |
| Claude API | Todos os agentes de IA | SDK Anthropic |

---

## 9. Considerações de Escalabilidade

- **Row Level Security** garante isolamento de dados sem overhead de schemas separados
- **Módulos desacoplados** permitem extrair serviços independentes no futuro se necessário
- **Eventos internos** (pattern observer) entre módulos permitem adicionar novos agentes sem alterar fluxo existente
- **Multi-tenant desde o dia 1** — novo tenant = nova Band, sem infraestrutura adicional

---

## 10. O que ficou fora do escopo v1

- App mobile nativo (iOS/Android) — v1 é PWA
- Relatórios financeiros avançados
- Integração com plataformas de streaming/streaming ao vivo
- Portal público da banda (site)
- Detalhamento completo dos agentes de IA (a ser especificado em sessão dedicada)

---

## 11. Próximos passos

1. Criar plano de implementação detalhado por módulo
2. Definir ordem de construção (MVP → iterações)
3. Sessão dedicada para detalhar comportamento dos Agentes de IA
