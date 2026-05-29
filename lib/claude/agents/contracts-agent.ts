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

  const event = await prisma.event.findUnique({ where: { lead_id } })
  if (!event) {
    console.warn(`Contracts Agent: evento para lead ${lead_id} não encontrado`)
    return
  }

  const existing = await prisma.contract.findFirst({ where: { event_id: event.id } })
  if (existing) return

  const template = await prisma.contractTemplate.findFirst({
    where: { band_id, is_default: true },
  })
  if (!template) {
    console.warn(`Contracts Agent: sem template padrão para banda ${band_id}`)
    return
  }

  const dynamicContext = buildContractsContext({
    client_name:     lead.client_name,
    phone:           lead.phone,
    event_type:      lead.event_type,
    event_date:      lead.event_date?.toISOString() ?? null,
    city:            lead.city,
    venue_name:      lead.venue_name,
    venue_has_sound: lead.venue_has_sound,
    venue_has_light: lead.venue_has_light,
    budget:          lead.budget ? parseFloat(lead.budget.toString()) : null,
    observations:    lead.observations,
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

  for (const block of response.content) {
    if (block.type !== 'tool_use') continue
    const result = await executeContractTool(block.name, block.input as Record<string, unknown>)
    console.log(`Contracts Agent tool ${block.name}:`, result)
  }
}
