import { describe, it, expect } from 'vitest'
import {
  normalizeNotesContent,
  isNotesDirty,
  buildNotesPayload,
  shouldConfirmTabChange,
} from '@/lib/production/alignment-notes'

describe('normalizeNotesContent', () => {
  it('trata o editor vazio ("<p></p>", que o Tiptap sempre devolve) como string vazia', () => {
    expect(normalizeNotesContent('<p></p>')).toBe('')
  })

  it('mantém o HTML de um conteúdo com texto', () => {
    expect(normalizeNotesContent('<p>Chegar às 14h</p>')).toBe('<p>Chegar às 14h</p>')
  })

  it('mantém formatação rica (negrito, listas)', () => {
    const html = '<ul><li><strong>Som</strong>: verificar antes das 15h</li></ul>'
    expect(normalizeNotesContent(html)).toBe(html)
  })
})

describe('isNotesDirty — o que habilita o botão Salvar e o aviso de alterações não salvas', () => {
  it('não fica "sujo" quando o conteúdo é igual ao último salvo', () => {
    expect(isNotesDirty('<p>Texto salvo</p>', '<p>Texto salvo</p>')).toBe(false)
  })

  it('fica "sujo" ao digitar algo diferente do último salvo', () => {
    expect(isNotesDirty('<p>Texto novo</p>', '<p>Texto salvo</p>')).toBe(true)
  })

  it('editor recém-carregado (vazio) não é "sujo" quando o último salvo também é vazio', () => {
    expect(isNotesDirty('<p></p>', '')).toBe(false)
  })

  it('apagar todo o conteúdo salvo deixa "sujo" (precisa salvar o esvaziamento)', () => {
    expect(isNotesDirty('<p></p>', '<p>Tinha conteúdo</p>')).toBe(true)
  })
})

describe('buildNotesPayload — corpo enviado para PATCH /api/events/[id]', () => {
  it('envia o HTML normalizado quando há conteúdo', () => {
    expect(buildNotesPayload('<p>Levar rider técnico</p>')).toEqual({ notes: '<p>Levar rider técnico</p>' })
  })

  it('envia null (não string vazia) quando o editor está vazio — mesma convenção do backend', () => {
    expect(buildNotesPayload('<p></p>')).toEqual({ notes: null })
  })
})

describe('shouldConfirmTabChange — aviso ao trocar de aba com edição pendente', () => {
  it('pede confirmação ao sair da aba "geral" com Alinhamentos sujo', () => {
    expect(shouldConfirmTabChange('geral', 'formacao', true)).toBe(true)
  })

  it('não pede nada se não há alteração pendente', () => {
    expect(shouldConfirmTabChange('geral', 'formacao', false)).toBe(false)
  })

  it('não pede nada trocando entre outras abas (o campo nem está montado lá)', () => {
    expect(shouldConfirmTabChange('formacao', 'financeiro', true)).toBe(false)
  })

  it('não pede nada "trocando" para a própria aba geral', () => {
    expect(shouldConfirmTabChange('geral', 'geral', true)).toBe(false)
  })
})
