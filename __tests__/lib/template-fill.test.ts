import { describe, it, expect } from 'vitest'
import {
  fillTemplate,
  extractVariables,
  buildContractData,
} from '../../lib/contracts/template-fill'

describe('fillTemplate', () => {
  it('replaces a single variable correctly', () => {
    const result = fillTemplate('Olá, {{cliente_nome}}!', { cliente_nome: 'João Silva' })
    expect(result).toBe('Olá, João Silva!')
  })

  it('replaces multiple variables in the same string', () => {
    const result = fillTemplate(
      'Contrato para {{tipo_evento}} em {{cidade}} no dia {{data_evento}}.',
      {
        tipo_evento: 'casamento',
        cidade: 'São Paulo',
        data_evento: '15/06/2025',
      }
    )
    expect(result).toBe('Contrato para casamento em São Paulo no dia 15/06/2025.')
  })

  it('renders [variable não informado] for missing variables', () => {
    const result = fillTemplate('Valor: {{valor}}', {})
    expect(result).toBe('Valor: [valor não informado]')
  })

  it('returns unchanged string when there are no {{}} patterns', () => {
    const result = fillTemplate('Texto sem variáveis.', { foo: 'bar' })
    expect(result).toBe('Texto sem variáveis.')
  })
})

describe('extractVariables', () => {
  it('returns an array of unique variable names from a template string', () => {
    const vars = extractVariables(
      'Contrato para {{tipo_evento}} em {{cidade}}. Cliente: {{cliente_nome}}. Local: {{cidade}}.'
    )
    expect(vars).toEqual(
      expect.arrayContaining(['tipo_evento', 'cidade', 'cliente_nome'])
    )
    expect(vars).toHaveLength(3)
  })

  it('returns empty array when there are no variables', () => {
    const vars = extractVariables('Texto sem variáveis.')
    expect(vars).toEqual([])
  })
})

describe('buildContractData', () => {
  it('maps all lead fields to Portuguese dictionary keys', () => {
    const lead = {
      client_name: 'Maria Souza',
      phone: '11999999999',
      event_type: 'formatura',
      event_date: new Date('2025-12-20T00:00:00.000Z'),
      city: 'Campinas',
      venue_name: 'Salão Estrela',
      budget: { toString: () => '5000.00' },
      observations: 'Nenhuma observação',
    }

    const data = buildContractData(lead)

    expect(data['cliente_nome']).toBe('Maria Souza')
    expect(data['cliente_telefone']).toBe('11999999999')
    expect(data['tipo_evento']).toBe('formatura')
    expect(data['cidade']).toBe('Campinas')
    expect(data['local']).toBe('Salão Estrela')
    expect(data['observacoes']).toBe('Nenhuma observação')
    // date should be in pt-BR format
    expect(data['data_evento']).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    // budget should be formatted as BRL currency
    expect(data['valor']).toMatch(/R\$/)
  })

  it('handles null optional fields with fallback values', () => {
    const lead = {
      client_name: 'Carlos Lima',
      phone: '21988887777',
      event_type: 'aniversario',
      event_date: null,
      city: null,
      venue_name: null,
      budget: null,
      observations: null,
    }

    const data = buildContractData(lead)

    expect(data['data_evento']).toBe('[data não informada]')
    expect(data['cidade']).toBe('[não informado]')
    expect(data['local']).toBe('[não informado]')
    expect(data['valor']).toBe('[não informado]')
    expect(data['observacoes']).toBe('')
  })
})
