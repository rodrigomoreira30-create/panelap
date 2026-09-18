import { z } from 'zod'

export const paymentMethods = ['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Boleto', 'Cheque', 'Outro'] as const

export const eventPaymentCreateSchema = z.object({
  payment_date:   z.string().min(1, 'Data obrigatória'),
  amount:         z.number().positive('Valor deve ser maior que zero'),
  payment_method: z.enum(paymentMethods),
  notes:          z.string().max(500).optional(),
})

export const eventPaymentUpdateSchema = z.object({
  payment_date:   z.string().min(1).optional(),
  amount:         z.number().positive('Valor deve ser maior que zero').optional(),
  payment_method: z.enum(paymentMethods).optional(),
  notes:          z.string().max(500).optional().nullable(),
})

export type EventPaymentCreateInput = z.infer<typeof eventPaymentCreateSchema>
export type EventPaymentUpdateInput = z.infer<typeof eventPaymentUpdateSchema>
