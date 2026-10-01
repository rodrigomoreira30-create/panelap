import { z } from 'zod'

const eventTypes = ['wedding', 'party', 'show', 'corporate', 'other'] as const

export const leadCreateSchema = z.object({
  client_name:     z.string().min(2, 'Nome obrigatório'),
  phone:           z.string().optional().default(''),
  event_type:      z.enum(eventTypes),
  source:          z.string().min(1, 'Fonte obrigatória'),
  event_date:      z.string().min(1).optional(),
  city:            z.string().optional(),
  venue_name:      z.string().optional(),
  budget:          z.number().positive().optional(),
  assigned_to:     z.string().cuid().optional(),
  assessor:        z.string().optional(),
  assessor_phone:  z.string().optional(),
  observations:    z.string().optional(),
  tags:            z.array(z.string().min(1).max(50)).optional(),
})

export const leadUpdateSchema = z.object({
  client_name:      z.string().min(2).optional(),
  // A tela de edição (Comercial → Dados) sempre reenvia o telefone atual do lead junto
  // com qualquer outro campo alterado. leadCreateSchema não exige tamanho mínimo (nem
  // obriga o campo), então um lead pode legitimamente existir sem telefone ou com um
  // telefone curto — exigir min(10) aqui bloqueava a edição de QUALQUER outro campo
  // desses leads (ex.: "Grupo Commolati", phone: "").
  phone:            z.string().optional(),
  event_type:       z.enum(eventTypes).optional(),
  source:           z.string().min(1).optional().nullable(),
  event_date:       z.string().min(1).optional().nullable(),
  // city/venue_name/observations: o formulário envia `null` (não omite o campo) quando
  // o usuário deixa o campo vazio — precisam aceitar null, não só string | undefined.
  city:             z.string().optional().nullable(),
  venue_name:       z.string().optional().nullable(),
  budget:           z.number().nonnegative().optional().nullable(),
  assigned_to:      z.string().cuid().optional().nullable(),
  status:           z.string().min(1).optional(),
  assessor:         z.string().optional().nullable(),
  assessor_phone:   z.string().optional().nullable(),
  observations:     z.string().optional().nullable(),
  tags:             z.array(z.string().min(1).max(50)).optional(),
  proposal_discount: z.number().min(0).optional().nullable(),
})

export type LeadCreateInput = z.infer<typeof leadCreateSchema>
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>
