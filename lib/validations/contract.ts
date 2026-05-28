import { z } from 'zod'

export const templateCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(255),
  content: z.string().min(10, 'Conteúdo deve ter ao menos 10 caracteres').max(50000),
  is_default: z.boolean().optional(),
})

export const templateUpdateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  content: z.string().min(10).max(50000).optional(),
  is_default: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' }
)

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>
