import { z } from 'zod'

export const eventUpdateSchema = z.object({
  client_name:          z.string().min(2).optional(),
  event_type:           z.enum(['wedding', 'party', 'show', 'corporate', 'other']).optional(),
  event_date:           z.string().min(1).optional(),
  event_time:           z.string().optional().nullable(),
  venue_name:           z.string().min(1).optional(),
  venue_address:        z.string().optional().nullable(),
  venue_has_sound:      z.boolean().optional(),
  venue_has_light:      z.boolean().optional(),
  value:                z.number().min(0).optional(),
  status:               z.enum(['contracted', 'active', 'done']).optional(),
  technical_visit_date: z.string().datetime().optional().nullable(),
  notes:                z.string().optional().nullable(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' })

export type EventUpdateInput = z.infer<typeof eventUpdateSchema>
