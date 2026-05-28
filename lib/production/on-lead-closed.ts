import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'
import { getDefaultChecklist } from './default-checklists'

export function registerProductionLeadClosedListener() {
  eventBus.on('lead.closed', async ({ lead_id, band_id }) => {
    try {
      const lead = await prisma.lead.findUnique({ where: { id: lead_id } })
      if (!lead) return

      // Check if event already exists for this lead
      const existingEvent = await prisma.event.findUnique({ where: { lead_id } })
      if (existingEvent) return

      if (!lead.event_date) {
        console.warn(`Lead ${lead_id} fechado sem data de evento — evento não criado.`)
        return
      }

      // Create event with data from lead
      const event = await prisma.event.create({
        data: {
          band_id,
          lead_id,
          client_name:     lead.client_name,
          event_type:      lead.event_type,
          event_date:      lead.event_date,
          venue_name:      lead.venue_name ?? 'A definir',
          venue_address:   lead.city ?? undefined,
          venue_has_sound: lead.venue_has_sound,
          venue_has_light: lead.venue_has_light,
          value:           lead.budget ?? 0,
          status:          'contracted',
          notes:           lead.observations ?? undefined,
        },
      })

      // Create default checklist for this event type
      const defaultItems = getDefaultChecklist(lead.event_type)
      await prisma.checklist.create({
        data: {
          event_id: event.id,
          title: 'Checklist Operacional',
          items: {
            create: defaultItems.map(item => ({
              description: item.description,
              done: false,
            })),
          },
        },
      })

      // Emit event for other modules
      eventBus.emit('event.created', { event_id: event.id, band_id })

      console.log(`Evento ${event.id} criado para lead ${lead_id}`)
    } catch (err) {
      console.error('Erro ao criar evento após lead.closed:', err)
    }
  })
}
