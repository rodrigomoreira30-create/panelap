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

describe('leadUpdateSchema — campos reenviados pela aba Dados do Comercial', () => {
  // A tela sempre reenvia TODOS os campos do formulário (não só o que mudou), então o
  // schema precisa aceitar os mesmos formatos que o LeadEditPanel realmente envia para
  // campos que já estão vazios/zerados — senão qualquer edição falha, mesmo em um campo
  // que o usuário nem tocou.

  it('aceita telefone vazio (lead sem telefone cadastrado) — reproduz o bug real: "Grupo Commolati" tem phone=""', () => {
    const result = leadUpdateSchema.safeParse({ phone: '' })
    expect(result.success).toBe(true)
  })

  it('aceita telefone com menos de 10 dígitos (não é mais exigido um tamanho mínimo na atualização)', () => {
    const result = leadUpdateSchema.safeParse({ phone: '1199' })
    expect(result.success).toBe(true)
  })

  it('aceita city como null (LeadEditPanel envia `form.city || null` quando o campo está vazio)', () => {
    expect(leadUpdateSchema.safeParse({ city: null }).success).toBe(true)
  })

  it('aceita venue_name (Local) como null quando vazio', () => {
    expect(leadUpdateSchema.safeParse({ venue_name: null }).success).toBe(true)
  })

  it('aceita observations como null quando vazio', () => {
    expect(leadUpdateSchema.safeParse({ observations: null }).success).toBe(true)
  })

  it('continua aceitando city, venue_name e observations com texto normal', () => {
    const result = leadUpdateSchema.safeParse({
      city: 'Sao Paulo',
      venue_name: 'Quintal do Espeto Santana',
      observations: 'Chegar 1h antes',
    })
    expect(result.success).toBe(true)
  })

  it('aceita orçamento igual a zero (não é mais exigido estritamente positivo)', () => {
    expect(leadUpdateSchema.safeParse({ budget: 0 }).success).toBe(true)
  })

  it('continua rejeitando orçamento negativo', () => {
    expect(leadUpdateSchema.safeParse({ budget: -100 }).success).toBe(false)
  })

  it('o payload real enviado pela tela ao editar Cidade e Local do lead "Grupo Commolati" agora é aceito', () => {
    // Mesmo payload que o handleSave do LeadEditPanel monta, com os valores reais do lead
    // (telefone vazio, orçamento nulo) mais a edição de Cidade/Local do relato do bug.
    const result = leadUpdateSchema.safeParse({
      client_name:     'Grupo Commolati',
      phone:           '',
      event_date:      null,
      city:            'Sao Paulo',
      venue_name:      'Quintal do Espeto Santana',
      budget:          null,
      observations:    'Horario do Evento: 19 as 00h00 NOITE',
      source:          'source_1782945762590',
      assessor:        null,
      assessor_phone:  null,
    })
    expect(result.success).toBe(true)
  })
})
