import { describe, it, expect } from 'vitest'
import { getDefaultChecklist } from '@/lib/production/default-checklists'

describe('getDefaultChecklist', () => {
  it('retorna itens para casamento', () => {
    const items = getDefaultChecklist('wedding')
    expect(items.length).toBeGreaterThan(3)
    expect(items.every(i => typeof i.description === 'string')).toBe(true)
  })

  it('retorna itens para show', () => {
    const items = getDefaultChecklist('show')
    expect(items.length).toBeGreaterThan(0)
  })

  it('retorna lista genérica para tipo desconhecido', () => {
    const items = getDefaultChecklist('unknown_type')
    expect(items.length).toBeGreaterThan(0)
  })

  it('todos os itens têm description não vazia', () => {
    const items = getDefaultChecklist('corporate')
    items.forEach(item => {
      expect(item.description.trim().length).toBeGreaterThan(0)
    })
  })
})
