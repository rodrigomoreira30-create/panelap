import { z } from 'zod'

export const registerSchema = z.object({
  band_name:  z.string().min(2, 'Nome da banda obrigatório'),
  admin_name: z.string().min(2, 'Nome do responsável obrigatório'),
  email:      z.string().email('Email inválido'),
  password:   z.string().min(8, 'Senha mínima de 8 caracteres'),
  plan:       z.enum(['starter', 'pro', 'enterprise']).default('starter'),
  cpf_cnpj:   z.string().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
