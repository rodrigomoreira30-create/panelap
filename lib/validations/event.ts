import { z } from 'zod'

export const eventUpdateSchema = z.object({
  event_time:           z.string().optional(),
  venue_address:        z.string().optional(),
  value:                z.number().positive().optional(),
  status:               z.enum(['contracted', 'active', 'done']).optional(),
  technical_visit_date: z.string().datetime().optional().nullable(),
  notes:                z.string().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' })

export type EventUpdateInput = z.infer<typeof eventUpdateSchema>
