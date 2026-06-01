import { describe, it, expect } from 'vitest'
import { leadCreateSchema, leadUpdateSchema } from '@/lib/validations/lead'

describe('leadCreateSchema', () => {
  it('valida payload mínimo correto com source', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João Silva',
      phone: '11999999999',
      event_type: 'wedding',
      source: 'referral',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita payload sem source', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João Silva',
      phone: '11999999999',
      event_type: 'wedding',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita payload sem client_name', () => {
    const result = leadCreateSchema.safeParse({
      phone: '11999999999',
      event_type: 'wedding',
      source: 'referral',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita event_type inválido', () => {
    const result = leadCreateSchema.safeParse({
      client_name: 'João',
      phone: '11999999999',
      event_type: 'invalid_type',
      source: 'referral',
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

  it('permite atualizar source', () => {
    const result = leadUpdateSchema.safeParse({ source: 'social_media' })
    expect(result.success).toBe(true)
  })

  it('rejeita source como string vazia', () => {
    const result = leadUpdateSchema.safeParse({ source: '' })
    expect(result.success).toBe(false)
  })

  it('permite source como null (lead sem fonte)', () => {
    const result = leadUpdateSchema.safeParse({ source: null })
    expect(result.success).toBe(true)
  })
})
