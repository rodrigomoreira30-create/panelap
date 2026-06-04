import { z } from 'zod'

export const attractionCreateSchema = z.object({
  name:          z.string().min(1, 'Nome obrigatório').max(100),
  category:      z.string().max(50).optional(),
  description:   z.string().max(500).optional(),
  default_value: z.number().min(0).default(0),
})

export const attractionUpdateSchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  category:      z.string().max(50).optional().nullable(),
  description:   z.string().max(500).optional().nullable(),
  default_value: z.number().min(0).optional(),
  is_active:     z.boolean().optional(),
})

export const leadAttractionCreateSchema = z.object({
  attraction_id: z.string().cuid(),
  custom_value:  z.number().min(0),
  observations:  z.string().max(500).optional(),
})

export const leadAttractionUpdateSchema = z.object({
  custom_value:  z.number().min(0).optional(),
  observations:  z.string().max(500).optional().nullable(),
})

export type AttractionCreateInput = z.infer<typeof attractionCreateSchema>
export type AttractionUpdateInput = z.infer<typeof attractionUpdateSchema>
export type LeadAttractionCreateInput = z.infer<typeof leadAttractionCreateSchema>
export type LeadAttractionUpdateInput = z.infer<typeof leadAttractionUpdateSchema>
