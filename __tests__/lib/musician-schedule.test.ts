import { describe, it, expect } from 'vitest'
import { formatCacheValue } from '@/lib/production/musician-schedule'

function decimal(value: number) {
  // Simula um Prisma.Decimal, que expõe apenas toString() (Number() o converte via coerção)
  return { toString: () => String(value) }
}

describe('formatCacheValue', () => {
  it('formata um cachê cadastrado em reais, com 2 casas decimais', () => {
    expect(formatCacheValue(decimal(700))).toBe('700,00')
  })

  it('músico A e músico B com cachês diferentes formatam de forma independente', () => {
    expect(formatCacheValue(decimal(500))).toBe('500,00')
    expect(formatCacheValue(decimal(700))).toBe('700,00')
  })

  it('retorna null quando o cachê não está cadastrado (null)', () => {
    expect(formatCacheValue(null)).toBeNull()
  })

  it('retorna null quando o cachê é undefined', () => {
    expect(formatCacheValue(undefined)).toBeNull()
  })

  it('retorna null quando o cachê é zero — não deve exibir "R$ 0,00"', () => {
    expect(formatCacheValue(decimal(0))).toBeNull()
    expect(formatCacheValue(0)).toBeNull()
  })

  it('retorna null para valor negativo (dado inconsistente, nunca deveria acontecer, mas não deve quebrar)', () => {
    expect(formatCacheValue(decimal(-100))).toBeNull()
  })

  it('aceita number puro além de objeto tipo Decimal', () => {
    expect(formatCacheValue(300)).toBe('300,00')
  })

  it('formata valores com centavos corretamente', () => {
    expect(formatCacheValue(decimal(1234.5))).toBe('1.234,50')
  })
})
