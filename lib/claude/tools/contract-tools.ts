import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { buildContractData } from '@/lib/contracts/template-fill'

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
  toolInput: Record<string, unknown>
): Promise<string> {
  if (toolName === 'create_contract') {
    const { event_id, template_id, notes } = toolInput as {
      event_id: string
      template_id: string
      notes?: string
    }

    const [event, template] = await Promise.all([
      prisma.event.findUnique({ where: { id: event_id }, include: { lead: true } }),
      prisma.contractTemplate.findUnique({ where: { id: template_id } }),
    ])

    if (!event || !template) {
      return JSON.stringify({ error: 'Event or template not found' })
    }

    const existing = await prisma.contract.findFirst({ where: { event_id } })
    if (existing) {
      return JSON.stringify({ success: true, contract_id: existing.id, already_existed: true })
    }

    buildContractData(event.lead)  // validates data is present

    const contract = await prisma.contract.create({
      data: { event_id, template_id, status: 'pending_review' },
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
