import { z } from 'zod'

const eventTypes = ['wedding', 'party', 'show', 'corporate', 'other'] as const

export const leadCreateSchema = z.object({
  client_name:     z.string().min(2, 'Nome obrigatório'),
  phone:           z.string().min(10, 'Telefone inválido'),
  event_type:      z.enum(eventTypes),
  source:          z.string().min(1, 'Fonte obrigatória'),
  event_date:      z.string().min(1).optional(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  venue_has_sound: z.boolean().optional().default(false),
  venue_has_light: z.boolean().optional().default(false),
  budget:          z.number().positive().optional(),
  assigned_to:     z.string().cuid().optional(),
  observations:    z.string().optional(),
  tags:            z.array(z.string().min(1).max(50)).optional(),
})

export const leadUpdateSchema = z.object({
  client_name:     z.string().min(2).optional(),
  phone:           z.string().min(10).optional(),
  event_type:      z.enum(eventTypes).optional(),
  source:          z.string().min(1).optional().nullable(),
  event_date:      z.string().min(1).optional().nullable(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  venue_has_sound: z.boolean().optional(),
  venue_has_light: z.boolean().optional(),
  budget:          z.number().positive().optional().nullable(),
  assigned_to:     z.string().cuid().optional().nullable(),
  status:          z.string().min(1).optional(),
  observations:    z.string().optional(),
  tags:            z.array(z.string().min(1).max(50)).optional(),
})

export type LeadCreateInput = z.infer<typeof leadCreateSchema>
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>
