import { describe, it, expect, vi } from 'vitest'
import { leadCreateSchema, leadUpdateSchema } from '@/lib/validations/lead'

describe('leadCreateSchema', () => {
  it('valida payload mínimo correto', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João Silva',
      phone: '11999999999',
      event_type: 'wedding',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita payload sem client_name', () => {
    const result = leadCreateSchema.safeParse({
      phone: '11999999999',
      event_type: 'wedding',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita event_type inválido', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João',
      phone: '11999999999',
      event_type: 'invalid_type',
    })
    expect(result.success).toBe(false)
  })
})

describe('leadUpdateSchema', () => {
  it('permite atualizar apenas o status', () => {
    const result = leadUpdateSchema.safeParse({ status: 'closed' })
    expect(result.success).toBe(true)
  })

  it('rejeita status inválido', () => {
    const result = leadUpdateSchema.safeParse({ status: 'unknown' })
    expect(result.success).toBe(false)
  })
})
