import { describe, it, expect } from 'vitest'
import { isSameDay, detectConflict } from '@/lib/agenda/conflict-detector'

describe('isSameDay', () => {
  it('retorna true para datas no mesmo dia', () => {
    expect(isSameDay(new Date('2026-06-15T10:00:00'), new Date('2026-06-15T22:00:00'))).toBe(true)
  })

  it('retorna false para datas em dias diferentes', () => {
    expect(isSameDay(new Date('2026-06-15'), new Date('2026-06-16'))).toBe(false)
  })
})

describe('detectConflict', () => {
  const bookedDates = [
    new Date('2026-06-15T18:00:00'),
    new Date('2026-06-20T20:00:00'),
  ]

  it('detecta conflito para data já reservada', () => {
    expect(detectConflict(new Date('2026-06-15T09:00:00'), bookedDates)).toBe(true)
  })

  it('não detecta conflito para data livre', () => {
    expect(detectConflict(new Date('2026-06-17'), bookedDates)).toBe(false)
  })

  it('retorna false para lista vazia', () => {
    expect(detectConflict(new Date('2026-06-15'), [])).toBe(false)
  })
})
