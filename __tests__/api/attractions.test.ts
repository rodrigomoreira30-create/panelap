import { describe, it, expect } from 'vitest'
import {
  attractionCreateSchema,
  attractionUpdateSchema,
  leadAttractionCreateSchema,
  leadAttractionUpdateSchema,
} from '@/lib/validations/attraction'

describe('attractionCreateSchema', () => {
  it('valida payload mínimo com nome', () => {
    const result = attractionCreateSchema.safeParse({ name: 'Banda Sapo Brasilis' })
    expect(result.success).toBe(true)
  })

  it('rejeita nome vazio', () => {
    const result = attractionCreateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('valida payload completo', () => {
    const result = attractionCreateSchema.safeParse({
      name: 'DJ',
      category: 'DJ',
      description: 'DJ profissional',
      default_value: 2500,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita default_value negativo', () => {
    const result = attractionCreateSchema.safeParse({ name: 'DJ', default_value: -100 })
    expect(result.success).toBe(false)
  })
})

describe('attractionUpdateSchema', () => {
  it('permite atualizar apenas is_active', () => {
    const result = attractionUpdateSchema.safeParse({ is_active: false })
    expect(result.success).toBe(true)
  })

  it('permite atualizar apenas o nome', () => {
    const result = attractionUpdateSchema.safeParse({ name: 'Novo Nome' })
    expect(result.success).toBe(true)
  })

  it('rejeita nome vazio na atualização', () => {
    const result = attractionUpdateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('leadAttractionCreateSchema', () => {
  it('valida payload mínimo com attraction_id e custom_value', () => {
    const result = leadAttractionCreateSchema.safeParse({
      attraction_id: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      custom_value: 12800,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita attraction_id que não é cuid', () => {
    const result = leadAttractionCreateSchema.safeParse({
      attraction_id: 'not-a-cuid',
      custom_value: 12800,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita custom_value negativo', () => {
    const result = leadAttractionCreateSchema.safeParse({
      attraction_id: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      custom_value: -500,
    })
    expect(result.success).toBe(false)
  })
})

describe('leadAttractionUpdateSchema', () => {
  it('permite atualizar apenas custom_value', () => {
    const result = leadAttractionUpdateSchema.safeParse({ custom_value: 14000 })
    expect(result.success).toBe(true)
  })

  it('permite zerar observations com null', () => {
    const result = leadAttractionUpdateSchema.safeParse({ observations: null })
    expect(result.success).toBe(true)
  })
})
