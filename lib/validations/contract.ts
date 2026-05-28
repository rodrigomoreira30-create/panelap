import { z } from 'zod'

export const templateCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  content: z.string().min(10, 'Conteúdo deve ter ao menos 10 caracteres'),
  is_default: z.boolean().optional(),
})

export const templateUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  content: z.string().min(10).optional(),
  is_default: z.boolean().optional(),
})

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>
