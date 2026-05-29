import { z } from 'zod'

const documentTypes = ['contract', 'rider', 'briefing', 'map', 'other'] as const

export const documentRegisterSchema = z.object({
  file_name: z.string().min(1),
  file_url:  z.string().url(),
  type:      z.enum(documentTypes),
  event_id:  z.string().cuid().optional(),
})

export const uploadUrlSchema = z.object({
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  event_id:  z.string().cuid().optional(),
})

export type DocumentRegisterInput = z.infer<typeof documentRegisterSchema>
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>
