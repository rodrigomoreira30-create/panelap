# PanelAp — Fase 6: Agentes de IA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 5 agentes de IA usando Claude API (claude-sonnet-4-6): SDR (atendimento WhatsApp), Contratos (geração automática), Produção (criação de card), Agenda (notificações) e Pós-venda (3 gatilhos).

**Architecture:** Cada agente é uma função assíncrona que recebe contexto (lead, evento, mensagem), chama `claude-sonnet-4-6` com um system prompt especializado e ferramentas (`tool_use`), e persiste o resultado no banco. Os agentes são acionados pelos listeners do event bus ou pelo webhook WhatsApp. Prompt caching habilitado com `cache_control` nos system prompts.

**Tech Stack:** Claude API (`claude-sonnet-4-6`), `@anthropic-ai/sdk`, Prisma, Vitest.

**Pré-requisito:** Fases 0–5 completas.

---

## Mapa de Arquivos

```
lib/claude/
├── client.ts                    # Singleton Anthropic + helper com cache
├── tools/
│   ├── crm-tools.ts            # Ferramentas: update_lead, send_message
│   ├── contract-tools.ts       # Ferramentas: create_contract
│   └── schedule-tools.ts       # Ferramentas: check_conflicts, confirm_musician
├── agents/
│   ├── sdr-agent.ts            # Agente SDR — WhatsApp → CRM
│   ├── contracts-agent.ts      # Agente de Contratos
│   ├── production-agent.ts     # Agente de Produção
│   ├── schedule-agent.ts       # Agente de Agenda
│   └── postsale-agent.ts       # Agente de Pós-venda
└── prompts/
    ├── sdr.ts                  # System prompt do SDR
    ├── contracts.ts            # System prompt de Contratos
    ├── production.ts           # System prompt de Produção
    ├── schedule.ts             # System prompt de Agenda
    └── postsale.ts             # System prompt de Pós-venda
app/api/
└── agents/
    └── sdr/
        └── route.ts            # POST — acionar SDR manualmente
__tests__/lib/
├── claude-client.test.ts
└── sdr-agent.test.ts
```

---

## Task 1: Claude API Client com Cache

**Files:**
- Create: `lib/claude/client.ts`
- Create: `__tests__/lib/claude-client.test.ts`

- [ ] **Step 1: Escrever o teste do client**

```typescript
// __tests__/lib/claude-client.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildSystemWithCache, truncateToTokenLimit } from '@/lib/claude/client'

describe('buildSystemWithCache', () => {
  it('retorna array com cache_control no prompt estático', () => {
    const result = buildSystemWithCache('Você é um assistente.', 'Contexto dinâmico')
    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Você é um assistente.'),
      cache_control: { type: 'ephemeral' },
    })
    expect(result[1]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Contexto dinâmico'),
    })
  })

  it('retorna apenas o prompt estático quando não há contexto dinâmico', () => {
    const result = buildSystemWithCache('Prompt estático')
    expect(result).toHaveLength(1)
    expect(result[0].cache_control).toBeDefined()
  })
})

describe('truncateToTokenLimit', () => {
  it('não trunca texto curto', () => {
    const text = 'Texto curto'
    expect(truncateToTokenLimit(text, 1000)).toBe(text)
  })

  it('trunca texto muito longo', () => {
    const long = 'a'.repeat(10000)
    const result = truncateToTokenLimit(long, 100)
    expect(result.length).toBeLessThan(long.length)
    expect(result.endsWith('...[truncado]')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npx vitest run __tests__/lib/claude-client.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/claude/client'`

- [ ] **Step 3: Criar `lib/claude/client.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic }

export const anthropic =
  globalForAnthropic.anthropic ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic

export const MODEL = 'claude-sonnet-4-6' as const

// Aprox. 4 chars por token
const CHARS_PER_TOKEN = 4

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 13) + '...[truncado]'
}

// Constrói system prompt com cache no bloco estático
export function buildSystemWithCache(
  staticPrompt: string,
  dynamicContext?: string
): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: staticPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ]

  if (dynamicContext) {
    blocks.push({
      type: 'text',
      text: dynamicContext,
    })
  }

  return blocks
}

// Helper para chamada com retry simples
export async function callClaude(params: Anthropic.MessageCreateParamsNonStreaming) {
  try {
    return await anthropic.messages.create(params)
  } catch (err: any) {
    if (err?.status === 529) {
      // Overloaded — retry após 5s
      await new Promise(r => setTimeout(r, 5000))
      return await anthropic.messages.create(params)
    }
    throw err
  }
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

```bash
npx vitest run __tests__/lib/claude-client.test.ts
```

Esperado: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/claude/client.ts __tests__/lib/claude-client.test.ts
git commit -m "feat: Claude API client com cache ephemeral e helper de truncamento"
```

---

## Task 2: System Prompts dos Agentes

**Files:**
- Create: `lib/claude/prompts/sdr.ts`
- Create: `lib/claude/prompts/contracts.ts`
- Create: `lib/claude/prompts/production.ts`
- Create: `lib/claude/prompts/postsale.ts`

- [ ] **Step 1: Criar `lib/claude/prompts/sdr.ts`**

```typescript
export const SDR_SYSTEM_PROMPT = `Você é o assistente comercial virtual de uma banda musical.
Seu papel é atender novos leads que chegam pelo WhatsApp, coletar informações sobre o evento e enviar propostas.

SUAS RESPONSABILIDADES:
1. Responder dúvidas sobre a banda e os serviços oferecidos
2. Coletar as seguintes informações obrigatoriamente:
   - Data do evento
   - Tipo de evento (casamento, festa, show corporativo, etc.)
   - Local e cidade
   - O local já possui estrutura de som? (sim/não)
   - O local já possui estrutura de iluminação? (sim/não)
   - Orçamento estimado do cliente
3. Após coletar todos os dados, gerar e enviar uma proposta adequada
4. Fazer follow-up se o cliente não responder em 24h
5. Escalar para atendimento humano quando solicitado

REGRAS DE CONDUTA:
- Seja cordial, profissional e entusiástico
- Use linguagem informal mas respeitosa (tutear o cliente)
- Não invente informações sobre a banda — use apenas o contexto fornecido
- Se não souber a resposta, diga que vai verificar com a equipe
- Nunca prometa valores sem consultar o responsável comercial
- Se o cliente pedir para falar com uma pessoa, escale imediatamente

FORMATO DAS RESPOSTAS:
- Mensagens curtas e objetivas (máximo 3 parágrafos)
- Use emojis com moderação (🎵 🎸 ✅)
- Nunca envie mais de 2 mensagens consecutivas sem aguardar resposta`

export function buildSdrContext(band: {
  name: string
  description?: string
}, conversation: Array<{ direction: string; content: string }>) {
  const history = conversation
    .slice(-20) // últimas 20 mensagens
    .map(m => `[${m.direction === 'in' ? 'CLIENTE' : 'ASSISTENTE'}]: ${m.content}`)
    .join('\n')

  return `BANDA: ${band.name}
${band.description ? `DESCRIÇÃO: ${band.description}` : ''}

HISTÓRICO DA CONVERSA:
${history || '(Sem histórico — primeira mensagem)'}

Responda apenas à última mensagem do cliente.`
}
```

- [ ] **Step 2: Criar `lib/claude/prompts/contracts.ts`**

```typescript
export const CONTRACTS_SYSTEM_PROMPT = `Você é o assistente de contratos de uma banda musical.
Quando um lead é marcado como fechado, você analisa todos os dados da negociação e preenche o template de contrato.

SUAS RESPONSABILIDADES:
1. Ler os dados do lead/evento (cliente, data, local, valor, observações)
2. Verificar se todos os dados necessários estão presentes
3. Identificar o template de contrato mais adequado
4. Preencher todas as variáveis do template com os dados do lead
5. Criar o contrato no sistema para revisão humana

REGRAS CRÍTICAS:
- NUNCA crie um contrato sem dados obrigatórios (nome do cliente, data, valor)
- Se dados obrigatórios estiverem faltando, sinalize no campo de observações
- O contrato criado vai para status "pending_review" — um humano SEMPRE revisa antes do envio
- Use o template marcado como padrão, exceto se houver indicação específica

FORMATO DA RESPOSTA:
Retorne apenas a chamada de ferramenta create_contract com os dados preenchidos.`

export function buildContractsContext(lead: {
  client_name: string
  phone: string
  event_type: string
  event_date: string | null
  city: string | null
  venue_name: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  budget: number | null
  observations: string | null
}) {
  return `DADOS DO LEAD/NEGOCIAÇÃO:
- Cliente: ${lead.client_name}
- Telefone: ${lead.phone}
- Tipo de evento: ${lead.event_type}
- Data: ${lead.event_date ?? 'Não informada'}
- Cidade: ${lead.city ?? 'Não informada'}
- Local: ${lead.venue_name ?? 'Não informado'}
- Som incluso: ${lead.venue_has_sound ? 'Sim' : 'Não'}
- Luz inclusa: ${lead.venue_has_light ? 'Sim' : 'Não'}
- Valor acordado: ${lead.budget ? `R$ ${lead.budget.toLocaleString('pt-BR')}` : 'Não informado'}
- Observações: ${lead.observations ?? 'Nenhuma'}`
}
```

- [ ] **Step 3: Criar `lib/claude/prompts/production.ts`**

```typescript
export const PRODUCTION_SYSTEM_PROMPT = `Você é o assistente de produção de uma banda musical.
Quando um evento é criado, você organiza o card de produção e gera o checklist operacional adequado.

SUAS RESPONSABILIDADES:
1. Verificar se o card do evento foi criado corretamente com todos os dados
2. Confirmar que o checklist padrão foi gerado para o tipo de evento
3. Adicionar itens específicos ao checklist baseados nas características do evento
4. Notificar a equipe de produção sobre o novo evento
5. Registrar a visita técnica como pendente (data a confirmar pelo contratante)

REGRAS:
- Não defina data de visita técnica automaticamente — ela deve ser informada pelo cliente
- Se o local não tem som, adicionar itens de rider técnico ao checklist
- Se o local não tem luz, adicionar itens de iluminação ao checklist
- Notificações devem ser objetivas e conter: cliente, data, local

FORMATO DA RESPOSTA:
Retorne chamadas de ferramenta para atualizar o checklist e notificar a equipe.`

export function buildProductionContext(event: {
  client_name: string
  event_type: string
  event_date: string
  venue_name: string
  venue_address?: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  value: number
  notes?: string | null
}) {
  return `DADOS DO EVENTO:
- Cliente: ${event.client_name}
- Tipo: ${event.event_type}
- Data: ${event.event_date}
- Local: ${event.venue_name}${event.venue_address ? ` — ${event.venue_address}` : ''}
- Som no local: ${event.venue_has_sound ? 'Sim' : 'Não — providenciar equipamento'}
- Luz no local: ${event.venue_has_light ? 'Sim' : 'Não — providenciar iluminação'}
- Valor: R$ ${event.value.toLocaleString('pt-BR')}
- Observações: ${event.notes ?? 'Nenhuma'}`
}
```

- [ ] **Step 4: Criar `lib/claude/prompts/postsale.ts`**

```typescript
export const POSTSALE_SYSTEM_PROMPT = `Você é o assistente de pós-venda de uma banda musical.
Você gerencia o relacionamento com o cliente após a assinatura do contrato.

GATILHOS E RESPONSABILIDADES:

1. CONTRATO ASSINADO:
   - Enviar mensagem calorosa de boas-vindas
   - Confirmar os próximos passos ao cliente
   - Tom: entusiasmado e profissional

2. 20 DIAS ANTES DO EVENTO:
   - Contatar o cliente para reunião de alinhamento
   - Confirmar horário e local definitivos
   - Solicitar cronograma do evento
   - Confirmar necessidade de visita técnica
   - Tom: organizado e prestativo

3. 24H APÓS O EVENTO:
   - Agradecer pela oportunidade
   - Enviar pesquisa de satisfação
   - Solicitar depoimento e/ou foto do evento
   - Tom: grato e empolgado com os resultados

REGRAS:
- Use o nome do cliente em todas as mensagens
- Mencione detalhes específicos do evento (data, local) para personalizar
- Não envie mensagens genéricas — sempre referencie o contrato/evento específico`

export function buildPostsaleContext(trigger: 'contract_signed' | 'pre_event' | 'post_event', event: {
  client_name: string
  event_type: string
  event_date: string
  venue_name: string
}) {
  const triggerMap = {
    contract_signed: 'Contrato acabou de ser assinado pelo cliente.',
    pre_event:       '20 dias antes do evento. Momento de alinhar os últimos detalhes.',
    post_event:      '24 horas após o evento. Momento de colher feedback.',
  }

  return `CONTEXTO:
${triggerMap[trigger]}

EVENTO:
- Cliente: ${event.client_name}
- Tipo: ${event.event_type}
- Data: ${event.event_date}
- Local: ${event.venue_name}

Gere a mensagem WhatsApp adequada para este momento. Retorne apenas o texto da mensagem.`
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/claude/prompts/
git commit -m "feat: system prompts dos 5 agentes de IA com contextos dinâmicos"
```

---

## Task 3: Ferramentas (Tool Use) dos Agentes

**Files:**
- Create: `lib/claude/tools/crm-tools.ts`
- Create: `lib/claude/tools/contract-tools.ts`

- [ ] **Step 1: Criar `lib/claude/tools/crm-tools.ts`**

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'

export const crmTools: Anthropic.Tool[] = [
  {
    name: 'update_lead',
    description: 'Atualiza campos do lead no CRM com informações coletadas do cliente',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id:        { type: 'string', description: 'ID do lead' },
        event_type:     { type: 'string', enum: ['wedding', 'party', 'show', 'corporate', 'other'] },
        event_date:     { type: 'string', description: 'Data ISO 8601 do evento' },
        city:           { type: 'string' },
        venue_name:     { type: 'string' },
        venue_has_sound: { type: 'boolean' },
        venue_has_light: { type: 'boolean' },
        budget:         { type: 'number' },
        observations:   { type: 'string' },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'send_whatsapp_message',
    description: 'Envia mensagem WhatsApp ao cliente e registra no histórico',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['lead_id', 'message'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Marca o lead para atendimento humano e para o processamento do agente',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string' },
        reason:  { type: 'string' },
      },
      required: ['lead_id'],
    },
  },
]

export async function executeCrmTool(
  toolName: string,
  toolInput: Record<string, any>
): Promise<string> {
  if (toolName === 'update_lead') {
    const { lead_id, ...updates } = toolInput
    await prisma.lead.update({
      where: { id: lead_id },
      data: {
        ...updates,
        event_date: updates.event_date ? new Date(updates.event_date) : undefined,
      },
    })
    return JSON.stringify({ success: true, updated_fields: Object.keys(updates) })
  }

  if (toolName === 'send_whatsapp_message') {
    const lead = await prisma.lead.findUnique({ where: { id: toolInput.lead_id } })
    if (!lead) return JSON.stringify({ error: 'Lead not found' })

    await prisma.message.create({
      data: {
        lead_id:   toolInput.lead_id,
        direction: 'out',
        content:   toolInput.message,
        sent_by:   'agent',
      },
    })

    await sendWhatsAppMessage({ to: lead.phone, message: toolInput.message })
      .catch(err => console.error('WhatsApp send failed:', err))

    return JSON.stringify({ success: true })
  }

  if (toolName === 'escalate_to_human') {
    await prisma.lead.update({
      where: { id: toolInput.lead_id },
      data: { observations: `[ESCALAR PARA HUMANO] ${toolInput.reason ?? ''}` },
    })
    return JSON.stringify({ success: true, escalated: true })
  }

  return JSON.stringify({ error: `Tool ${toolName} not found` })
}
```

- [ ] **Step 2: Criar `lib/claude/tools/contract-tools.ts`**

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { fillTemplate, buildContractData } from '@/lib/contracts/template-fill'

export const contractTools: Anthropic.Tool[] = [
  {
    name: 'create_contract',
    description: 'Cria um contrato preenchido em status pending_review para revisão humana',
    input_schema: {
      type: 'object' as const,
      properties: {
        event_id:    { type: 'string', description: 'ID do evento' },
        template_id: { type: 'string', description: 'ID do template de contrato' },
        notes:       { type: 'string', description: 'Observações sobre dados faltantes' },
      },
      required: ['event_id', 'template_id'],
    },
  },
]

export async function executeContractTool(
  toolName: string,
  toolInput: Record<string, any>
): Promise<string> {
  if (toolName === 'create_contract') {
    const { event_id, template_id, notes } = toolInput

    const [event, template] = await Promise.all([
      prisma.event.findUnique({ where: { id: event_id }, include: { lead: true } }),
      prisma.contractTemplate.findUnique({ where: { id: template_id } }),
    ])

    if (!event || !template) {
      return JSON.stringify({ error: 'Event or template not found' })
    }

    // Verificar se já existe
    const existing = await prisma.contract.findFirst({ where: { event_id } })
    if (existing) return JSON.stringify({ success: true, contract_id: existing.id, already_existed: true })

    const data = buildContractData(event.lead as any)
    fillTemplate(template.content, data) // valida mas não persiste o preenchido (feito na revisão)

    const contract = await prisma.contract.create({
      data: {
        event_id,
        template_id,
        status: 'pending_review',
      },
    })

    if (notes) {
      await prisma.event.update({
        where: { id: event_id },
        data: { notes: `${event.notes ? event.notes + '\n' : ''}[Agente]: ${notes}` },
      })
    }

    return JSON.stringify({ success: true, contract_id: contract.id })
  }

  return JSON.stringify({ error: `Tool ${toolName} not found` })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/claude/tools/
git commit -m "feat: ferramentas (tool use) para agentes SDR e Contratos"
```

---

## Task 4: Agente SDR

**Files:**
- Create: `lib/claude/agents/sdr-agent.ts`
- Create: `__tests__/lib/sdr-agent.test.ts`

- [ ] **Step 1: Escrever o teste do SDR Agent**

```typescript
// __tests__/lib/sdr-agent.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildSdrContext } from '@/lib/claude/prompts/sdr'

// Apenas testamos as funções puras (buildSdrContext)
// O agente completo precisa de integração com Claude API

describe('buildSdrContext', () => {
  it('inclui nome da banda', () => {
    const ctx = buildSdrContext(
      { name: 'Banda Teste' },
      [{ direction: 'in', content: 'Olá' }]
    )
    expect(ctx).toContain('Banda Teste')
  })

  it('inclui histórico da conversa', () => {
    const ctx = buildSdrContext(
      { name: 'Banda' },
      [
        { direction: 'in', content: 'Oi' },
        { direction: 'out', content: 'Olá!' },
      ]
    )
    expect(ctx).toContain('[CLIENTE]: Oi')
    expect(ctx).toContain('[ASSISTENTE]: Olá!')
  })

  it('mostra mensagem de sem histórico quando conversa está vazia', () => {
    const ctx = buildSdrContext({ name: 'Banda' }, [])
    expect(ctx).toContain('primeira mensagem')
  })

  it('trunca histórico para as últimas 20 mensagens', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      direction: 'in',
      content: `Mensagem ${i + 1}`,
    }))
    const ctx = buildSdrContext({ name: 'Banda' }, messages)
    expect(ctx).not.toContain('Mensagem 1')
    expect(ctx).toContain('Mensagem 30')
  })
})
```

- [ ] **Step 2: Rodar para confirmar que passa (sem mock do Claude)**

```bash
npx vitest run __tests__/lib/sdr-agent.test.ts
```

Esperado: PASS (4 testes) — testando apenas a lógica pura.

- [ ] **Step 3: Criar `lib/claude/agents/sdr-agent.ts`**

```typescript
import { callClaude, buildSystemWithCache, MODEL } from '@/lib/claude/client'
import { SDR_SYSTEM_PROMPT, buildSdrContext } from '@/lib/claude/prompts/sdr'
import { crmTools, executeCrmTool } from '@/lib/claude/tools/crm-tools'
import { prisma } from '@/lib/prisma'

interface SdrAgentInput {
  lead_id: string
  new_message: string
}

export async function runSdrAgent({ lead_id, new_message }: SdrAgentInput): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: lead_id },
    include: {
      messages: { orderBy: { sent_at: 'asc' } },
      band: { select: { name: true } },
    },
  })

  if (!lead) {
    console.error(`SDR Agent: lead ${lead_id} não encontrado`)
    return
  }

  // Não processar leads já fechados ou perdidos
  if (['closed', 'lost'].includes(lead.status)) return

  // Verificar se está escalado para humano
  if (lead.observations?.includes('[ESCALAR PARA HUMANO]')) return

  const dynamicContext = buildSdrContext(
    { name: lead.band.name },
    lead.messages
  )

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: `Nova mensagem do cliente: ${new_message}` },
  ]

  let response = await callClaude({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemWithCache(SDR_SYSTEM_PROMPT, dynamicContext),
    tools: crmTools,
    messages,
  })

  // Loop de tool use
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    const toolResults = []

    for (const block of toolUseBlocks) {
      if (block.type !== 'tool_use') continue
      const result = await executeCrmTool(block.name, block.input as Record<string, any>)
      toolResults.push({
        type: 'tool_result' as const,
        tool_use_id: block.id,
        content: result,
      })
    }

    messages.push({ role: 'assistant', content: response.content as any })
    messages.push({ role: 'user', content: toolResults as any })

    response = await callClaude({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemWithCache(SDR_SYSTEM_PROMPT, dynamicContext),
      tools: crmTools,
      messages,
    })
  }

  // Extrair resposta de texto final e enviar como mensagem
  const textBlock = response.content.find(b => b.type === 'text')
  if (textBlock && textBlock.type === 'text' && textBlock.text.trim()) {
    await executeCrmTool('send_whatsapp_message', {
      lead_id,
      message: textBlock.text.trim(),
    })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/claude/agents/sdr-agent.ts __tests__/lib/sdr-agent.test.ts
git commit -m "feat: Agente SDR — atendimento WhatsApp com tool use e loop de ferramentas"
```

---

## Task 5: Agente de Contratos

**Files:**
- Create: `lib/claude/agents/contracts-agent.ts`

- [ ] **Step 1: Criar `lib/claude/agents/contracts-agent.ts`**

```typescript
import { callClaude, buildSystemWithCache, MODEL } from '@/lib/claude/client'
import { CONTRACTS_SYSTEM_PROMPT, buildContractsContext } from '@/lib/claude/prompts/contracts'
import { contractTools, executeContractTool } from '@/lib/claude/tools/contract-tools'
import { prisma } from '@/lib/prisma'

interface ContractsAgentInput {
  lead_id: string
  band_id: string
}

export async function runContractsAgent({ lead_id, band_id }: ContractsAgentInput): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: lead_id } })
  if (!lead) return

  // Buscar evento criado para este lead
  const event = await prisma.event.findUnique({ where: { lead_id } })
  if (!event) {
    console.warn(`Contracts Agent: evento para lead ${lead_id} não encontrado`)
    return
  }

  // Verificar se já existe contrato
  const existing = await prisma.contract.findFirst({ where: { event_id: event.id } })
  if (existing) return

  // Buscar template padrão
  const template = await prisma.contractTemplate.findFirst({
    where: { band_id, is_default: true },
  })
  if (!template) {
    console.warn(`Contracts Agent: sem template padrão para banda ${band_id}`)
    return
  }

  const dynamicContext = buildContractsContext({
    client_name:    lead.client_name,
    phone:          lead.phone,
    event_type:     lead.event_type,
    event_date:     lead.event_date?.toISOString() ?? null,
    city:           lead.city,
    venue_name:     lead.venue_name,
    venue_has_sound: lead.venue_has_sound,
    venue_has_light: lead.venue_has_light,
    budget:         lead.budget,
    observations:   lead.observations,
  })

  const response = await callClaude({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemWithCache(CONTRACTS_SYSTEM_PROMPT, dynamicContext),
    tools: contractTools,
    tool_choice: { type: 'any' },
    messages: [
      {
        role: 'user',
        content: `Crie o contrato para o evento ${event.id} usando o template ${template.id}.`,
      },
    ],
  })

  // Executar tool use
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue
    const result = await executeContractTool(block.name, block.input as Record<string, any>)
    console.log(`Contracts Agent tool ${block.name}:`, result)
  }
}
```

- [ ] **Step 2: Atualizar `lib/contracts/on-lead-closed.ts` para usar o agente**

```typescript
// Substituir o conteúdo do listener por:
import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'
import { runContractsAgent } from '@/lib/claude/agents/contracts-agent'

export function registerContractLeadClosedListener() {
  eventBus.on('lead.closed', async ({ lead_id, band_id }) => {
    try {
      await runContractsAgent({ lead_id, band_id })
    } catch (err) {
      console.error('Contracts Agent error:', err)
    }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/claude/agents/contracts-agent.ts lib/contracts/on-lead-closed.ts
git commit -m "feat: Agente de Contratos — cria contrato automaticamente via Claude API"
```

---

## Task 6: Agente de Pós-venda

**Files:**
- Create: `lib/claude/agents/postsale-agent.ts`
- Create: `lib/postsale/triggers.ts`

- [ ] **Step 1: Criar `lib/claude/agents/postsale-agent.ts`**

```typescript
import { callClaude, buildSystemWithCache, MODEL } from '@/lib/claude/client'
import { POSTSALE_SYSTEM_PROMPT, buildPostsaleContext } from '@/lib/claude/prompts/postsale'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PostsaleTrigger = 'contract_signed' | 'pre_event' | 'post_event'

interface PostsaleAgentInput {
  event_id: string
  trigger: PostsaleTrigger
}

export async function runPostsaleAgent({ event_id, trigger }: PostsaleAgentInput): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: event_id },
    include: { lead: { select: { phone: true } } },
  })

  if (!event) return

  const dynamicContext = buildPostsaleContext(trigger, {
    client_name: event.client_name,
    event_type:  event.event_type,
    event_date:  format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR }),
    venue_name:  event.venue_name,
  })

  const response = await callClaude({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemWithCache(POSTSALE_SYSTEM_PROMPT, dynamicContext),
    messages: [
      { role: 'user', content: 'Gere a mensagem adequada para este momento.' },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return

  const message = textBlock.text.trim()
  if (!message || !event.lead.phone) return

  await sendWhatsAppMessage({ to: event.lead.phone, message })
    .catch(err => console.error(`Postsale WhatsApp failed (${trigger}):`, err))
}
```

- [ ] **Step 2: Criar `lib/postsale/triggers.ts`**

Este arquivo contém a lógica de agendamento dos gatilhos de pós-venda. Na v1, é chamado por um cron job ou webhook.

```typescript
import { prisma } from '@/lib/prisma'
import { runPostsaleAgent } from '@/lib/claude/agents/postsale-agent'
import { eventBus } from '@/lib/events/internal-bus'

// Gatilho 1: contrato assinado
export function registerPostsaleContractSignedListener() {
  eventBus.on('contract.signed', async ({ contract_id }) => {
    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contract_id },
        select: { event_id: true },
      })
      if (!contract) return
      await runPostsaleAgent({ event_id: contract.event_id, trigger: 'contract_signed' })
    } catch (err) {
      console.error('Postsale contract_signed error:', err)
    }
  })
}

// Gatilho 2 e 3: chamados por cron (ver Fase 7 ou script externo)
export async function triggerPreEventMessages(): Promise<void> {
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + 20)

  const dayStart = new Date(targetDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(targetDate)
  dayEnd.setHours(23, 59, 59, 999)

  const events = await prisma.event.findMany({
    where: {
      event_date: { gte: dayStart, lte: dayEnd },
      status: { in: ['contracted', 'active'] },
    },
  })

  for (const event of events) {
    await runPostsaleAgent({ event_id: event.id, trigger: 'pre_event' })
      .catch(err => console.error(`Pre-event trigger failed for ${event.id}:`, err))
  }
}

export async function triggerPostEventMessages(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const dayStart = new Date(yesterday)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(yesterday)
  dayEnd.setHours(23, 59, 59, 999)

  const events = await prisma.event.findMany({
    where: {
      event_date: { gte: dayStart, lte: dayEnd },
    },
  })

  for (const event of events) {
    await runPostsaleAgent({ event_id: event.id, trigger: 'post_event' })
      .catch(err => console.error(`Post-event trigger failed for ${event.id}:`, err))
  }
}
```

- [ ] **Step 3: Registrar listener no `instrumentation.ts`**

```typescript
// Adicionar ao instrumentation.ts:
const { registerPostsaleContractSignedListener } = await import('@/lib/postsale/triggers')
registerPostsaleContractSignedListener()
```

- [ ] **Step 4: Commit**

```bash
git add lib/claude/agents/postsale-agent.ts lib/postsale/ instrumentation.ts
git commit -m "feat: Agente de Pós-venda com 3 gatilhos (contrato assinado, pré-evento, pós-evento)"
```

---

## Task 7: Conectar SDR ao Webhook WhatsApp

**Files:**
- Modify: `app/api/webhooks/whatsapp/route.ts`

- [ ] **Step 1: Atualizar o webhook WhatsApp para acionar o SDR**

```typescript
// No final do handler POST, após salvar a mensagem, adicionar:
import { runSdrAgent } from '@/lib/claude/agents/sdr-agent'

// Dentro do handler, após criar a mensagem e o lead (se necessário):
// Acionar SDR assincronamente (não bloquear o webhook)
if (lead) {
  runSdrAgent({ lead_id: lead.id, new_message: content })
    .catch(err => console.error('SDR Agent error:', err))
}
```

O arquivo completo atualizado:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runSdrAgent } from '@/lib/claude/agents/sdr-agent'
import crypto from 'crypto'

function verifySignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')
  return `sha256=${expected}` === signature
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const phone: string = payload.from
  const content: string = payload.body ?? payload.text ?? ''

  if (!phone || !content) return NextResponse.json({ ok: true })

  const normalizedPhone = phone.replace(/\D/g, '')
  let lead = await prisma.lead.findFirst({
    where: { phone: { contains: normalizedPhone } },
  })

  if (lead) {
    await prisma.message.create({
      data: { lead_id: lead.id, direction: 'in', content, sent_by: 'client' },
    })
  } else {
    const bands = await prisma.band.findMany({ select: { id: true }, take: 1 })
    if (bands.length > 0) {
      lead = await prisma.lead.create({
        data: {
          band_id:    bands[0].id,
          client_name: phone,
          phone:       normalizedPhone,
          event_type:  'other',
          status:      'new_lead',
        },
      })
      await prisma.message.create({
        data: { lead_id: lead.id, direction: 'in', content, sent_by: 'client' },
      })
    }
  }

  if (lead) {
    runSdrAgent({ lead_id: lead.id, new_message: content })
      .catch(err => console.error('SDR Agent error:', err))
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Criar rota de acionamento manual do SDR (para debug)**

```typescript
// app/api/agents/sdr/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { runSdrAgent } from '@/lib/claude/agents/sdr-agent'
import { z } from 'zod'

const schema = z.object({ lead_id: z.string().cuid(), message: z.string().min(1) })

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser || !['admin', 'commercial'].includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data.lead_id, band_id: dbUser.band_id },
  })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  await runSdrAgent({ lead_id: parsed.data.lead_id, new_message: parsed.data.message })
  return NextResponse.json({ data: { triggered: true } })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/whatsapp/route.ts app/api/agents/
git commit -m "feat: webhook WhatsApp aciona SDR Agent + rota de debug manual"
```

---

## Task 8: Verificação Final dos Agentes IA

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: sem erros TypeScript.

- [ ] **Step 3: Teste de integração (requer ANTHROPIC_API_KEY válida)**

```bash
# Testar SDR manualmente via curl
curl -X POST http://localhost:3000/api/agents/sdr \
  -H "Content-Type: application/json" \
  -H "Cookie: [cookie de sessão]" \
  -d '{"lead_id": "LEAD_ID_AQUI", "message": "Olá, gostaria de informações para meu casamento"}'
```

Verificar:
1. A resposta do agente aparece no histórico de mensagens do lead
2. Os campos do lead são atualizados conforme a conversa evolui
3. O agente escala para humano quando solicitado

- [ ] **Step 4: Verificar cache hits no console**

Ao executar múltiplas chamadas, verificar nos logs do Anthropic SDK que `cache_read_input_tokens > 0` (indica que o cache está sendo utilizado).

- [ ] **Step 5: Commit final da fase**

```bash
git add .
git commit -m "feat: Fase 6 completa — 5 Agentes IA com Claude API, tool use e prompt caching"
```

---

## Checklist da Fase 6

- [ ] `buildSystemWithCache` e `truncateToTokenLimit` testados (4 testes)
- [ ] `buildSdrContext` testado (4 testes)
- [ ] Agente SDR com loop de tool use funcionando
- [ ] `crmTools` (update_lead, send_whatsapp_message, escalate) executando
- [ ] Agente de Contratos criando `Contract` em `pending_review`
- [ ] `contractTools` (create_contract) executando
- [ ] Agente de Pós-venda com 3 gatilhos implementados
- [ ] Webhook WhatsApp acionando SDR assincronamente
- [ ] Prompt caching habilitado (cache_control: ephemeral)
- [ ] `instrumentation.ts` registrando todos os listeners
- [ ] Rota de debug `/api/agents/sdr` funcionando
- [ ] Todos os testes passando

**Próximo:** [Fase 7 — Billing (Asaas)](./2026-05-25-fase-7-billing.md)
