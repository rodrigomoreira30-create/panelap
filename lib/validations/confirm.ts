import { z } from 'zod'
export const confirmSchema = z.object({
  action: z.enum(['confirm', 'decline']),
})
