import { parseInitialTab } from '@/lib/production/event-tab'

describe('parseInitialTab', () => {
  it('aceita abas válidas vindas da URL', () => {
    expect(parseInitialTab('financeiro')).toBe('financeiro')
    expect(parseInitialTab(['formacao', 'chat'])).toBe('formacao')
  })

  it('cai em "geral" quando o parâmetro está ausente ou é desconhecido', () => {
    expect(parseInitialTab(undefined)).toBe('geral')
    expect(parseInitialTab('')).toBe('geral')
    expect(parseInitialTab('admin')).toBe('geral')
  })
})
