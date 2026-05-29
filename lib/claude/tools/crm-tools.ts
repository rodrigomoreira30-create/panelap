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
        lead_id:         { type: 'string', description: 'ID do lead' },
        event_type:      { type: 'string', enum: ['wedding', 'party', 'show', 'corporate', 'other'] },
        event_date:      { type: 'string', description: 'Data ISO 8601 do evento' },
        city:            { type: 'string' },
        venue_name:      { type: 'string' },
        venue_has_sound: { type: 'boolean' },
        venue_has_light: { type: 'boolean' },
        budget:          { type: 'number' },
        observations:    { type: 'string' },
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
  toolInput: Record<string, unknown>
): Promise<string> {
  if (toolName === 'update_lead') {
    const { lead_id, event_date, ...rest } = toolInput as {
      lead_id: string
      event_date?: string
      [key: string]: unknown
    }
    await prisma.lead.update({
      where: { id: lead_id },
      data: {
        ...rest,
        event_date: event_date ? new Date(event_date) : undefined,
      },
    })
    return JSON.stringify({ success: true, updated_fields: Object.keys(rest) })
  }

  if (toolName === 'send_whatsapp_message') {
    const { lead_id, message } = toolInput as { lead_id: string; message: string }
    const lead = await prisma.lead.findUnique({ where: { id: lead_id } })
    if (!lead) return JSON.stringify({ error: 'Lead not found' })

    await prisma.message.create({
      data: {
        lead_id,
        direction: 'out',
        content:   message,
        sent_by:   'agent',
      },
    })

    await sendWhatsAppMessage({ to: lead.phone, message })
      .catch(err => console.error('WhatsApp send failed:', err))

    return JSON.stringify({ success: true })
  }

  if (toolName === 'escalate_to_human') {
    const { lead_id, reason } = toolInput as { lead_id: string; reason?: string }
    await prisma.lead.update({
      where: { id: lead_id },
      data: { observations: `[ESCALAR PARA HUMANO] ${reason ?? ''}` },
    })
    return JSON.stringify({ success: true, escalated: true })
  }

  return JSON.stringify({ error: `Tool ${toolName} not found` })
}
