import { describe, it, expect } from 'vitest'
import { buildSdrContext } from '@/lib/claude/prompts/sdr'

describe('buildSdrContext', () => {
  it('inclui nome da banda', () => {
    const ctx = buildSdrContext(
      { name: 'Banda Teste' },
      [{ direction: 'in', content: 'Olá' }]
    )
    expect(ctx).toContain('Banda Teste')
  })

  it('inclui histórico da conversa', () => {
    const ctx = buildSdrContext(
      { name: 'Banda' },
      [
        { direction: 'in', content: 'Oi' },
        { direction: 'out', content: 'Olá!' },
      ]
    )
    expect(ctx).toContain('[CLIENTE]: Oi')
    expect(ctx).toContain('[ASSISTENTE]: Olá!')
  })

  it('mostra mensagem de sem histórico quando conversa está vazia', () => {
    const ctx = buildSdrContext({ name: 'Banda' }, [])
    expect(ctx).toContain('primeira mensagem')
  })

  it('trunca histórico para as últimas 20 mensagens', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      direction: 'in',
      content: `Mensagem ${i + 1}`,
    }))
    const ctx = buildSdrContext({ name: 'Banda' }, messages)
    // Messages 1–10 are dropped; "Mensagem 1\n" matches only the first message line
    expect(ctx).not.toContain('[CLIENTE]: Mensagem 1\n')
    expect(ctx).toContain('Mensagem 30')
  })
})
