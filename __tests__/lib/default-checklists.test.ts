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

  it('retorna itens para festa', () => {
    const items = getDefaultChecklist('party')
    expect(items.length).toBeGreaterThan(0)
  })

  it('retorna itens para tipo other', () => {
    const items = getDefaultChecklist('other')
    expect(items.length).toBeGreaterThan(0)
  })

  it('todos os itens de todos os tipos têm description não vazia', () => {
    for (const type of ['wedding', 'show', 'corporate', 'party', 'other', 'unknown']) {
      const items = getDefaultChecklist(type)
      items.forEach(item => {
        expect(item.description.trim().length).toBeGreaterThan(0)
      })
    }
  })
})
