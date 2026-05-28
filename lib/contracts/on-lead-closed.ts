import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'

export function registerLeadClosedContractListener() {
  eventBus.on('lead.closed', async ({ lead_id, band_id }) => {
    try {
      // 1. Find the event linked to this lead
      const event = await prisma.event.findUnique({
        where: { lead_id },
        select: { id: true }
      })
      if (!event) return

      // 2. Find the default template for this band
      const template = await prisma.contractTemplate.findFirst({
        where: { band_id, is_default: true },
        select: { id: true }
      })
      if (!template) return

      // 3. Check if contract already exists for this event
      const existing = await prisma.contract.findFirst({
        where: { event_id: event.id }
      })
      if (existing) return

      // 4. Create draft contract
      await prisma.contract.create({
        data: {
          event_id: event.id,
          template_id: template.id,
          status: 'draft',
        }
      })
    } catch (err) {
      console.error('on-lead-closed: failed to create contract', err)
    }
  })
}
