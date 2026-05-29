import { describe, it, expect } from 'vitest'
import { buildSystemWithCache, truncateToTokenLimit } from '@/lib/claude/client'

describe('buildSystemWithCache', () => {
  it('retorna array com cache_control no prompt estático', () => {
    const result = buildSystemWithCache('Você é um assistente.', 'Contexto dinâmico')
    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Você é um assistente.'),
      cache_control: { type: 'ephemeral' },
    })
    expect(result[1]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Contexto dinâmico'),
    })
  })

  it('retorna apenas o prompt estático quando não há contexto dinâmico', () => {
    const result = buildSystemWithCache('Prompt estático')
    expect(result).toHaveLength(1)
    expect(result[0].cache_control).toBeDefined()
  })
})

describe('truncateToTokenLimit', () => {
  it('não trunca texto curto', () => {
    const text = 'Texto curto'
    expect(truncateToTokenLimit(text, 1000)).toBe(text)
  })

  it('trunca texto muito longo', () => {
    const long = 'a'.repeat(10000)
    const result = truncateToTokenLimit(long, 100)
    expect(result.length).toBeLessThan(long.length)
    expect(result.endsWith('...[truncado]')).toBe(true)
  })
})
