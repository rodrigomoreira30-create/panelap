import { z } from 'zod'

const eventTypes = ['wedding', 'party', 'show', 'corporate', 'other'] as const
const leadStatuses = ['new_lead', 'attending', 'proposal_sent', 'negotiation', 'closed', 'lost'] as const

export const leadCreateSchema = z.object({
  client_name:     z.string().min(2, 'Nome obrigatório'),
  phone:           z.string().min(10, 'Telefone inválido'),
  event_type:      z.enum(eventTypes),
  event_date:      z.string().datetime().optional(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  venue_has_sound: z.boolean().optional().default(false),
  venue_has_light: z.boolean().optional().default(false),
  budget:          z.number().positive().optional(),
  assigned_to:     z.string().cuid().optional(),
  observations:    z.string().optional(),
})

export const leadUpdateSchema = z.object({
  client_name:     z.string().min(2).optional(),
  phone:           z.string().min(10).optional(),
  event_type:      z.enum(eventTypes).optional(),
  event_date:      z.string().datetime().optional().nullable(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  venue_has_sound: z.boolean().optional(),
  venue_has_light: z.boolean().optional(),
  budget:          z.number().positive().optional().nullable(),
  assigned_to:     z.string().cuid().optional().nullable(),
  status:          z.enum(leadStatuses).optional(),
  observations:    z.string().optional(),
})

export type LeadCreateInput = z.infer<typeof leadCreateSchema>
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>
