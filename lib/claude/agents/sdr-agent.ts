import { callClaude, buildSystemWithCache, MODEL } from '@/lib/claude/client'
import { SDR_SYSTEM_PROMPT, buildSdrContext } from '@/lib/claude/prompts/sdr'
import { crmTools, executeCrmTool } from '@/lib/claude/tools/crm-tools'
import { prisma } from '@/lib/prisma'
import type Anthropic from '@anthropic-ai/sdk'

interface SdrAgentInput {
  lead_id: string
  new_message: string
}

export async function runSdrAgent({ lead_id, new_message }: SdrAgentInput): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: lead_id },
    include: {
      messages: { orderBy: { sent_at: 'asc' } },
      band:     { select: { name: true } },
    },
  })

  if (!lead) {
    console.error(`SDR Agent: lead ${lead_id} não encontrado`)
    return
  }

  if (['closed', 'lost'].includes(lead.status)) return
  if (lead.observations?.includes('[ESCALAR PARA HUMANO]')) return

  const dynamicContext = buildSdrContext(
    { name: lead.band.name },
    lead.messages
  )

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Nova mensagem do cliente: ${new_message}` },
  ]

  let response = await callClaude({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemWithCache(SDR_SYSTEM_PROMPT, dynamicContext),
    tools: crmTools,
    messages,
  })

  while (response.stop_reason === 'tool_use') {
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue
      const result = await executeCrmTool(block.name, block.input as Record<string, unknown>)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      })
    }

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })

    response = await callClaude({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemWithCache(SDR_SYSTEM_PROMPT, dynamicContext),
      tools: crmTools,
      messages,
    })
  }

  const textBlock = response.content.find(b => b.type === 'text')
  if (textBlock && textBlock.type === 'text' && textBlock.text.trim()) {
    await executeCrmTool('send_whatsapp_message', {
      lead_id,
      message: textBlock.text.trim(),
    })
  }
}
