import { describe, it, expect } from 'vitest'
import { Guitar, Drum, Piano, MicVocal, Volume2, Music, Sparkles } from 'lucide-react'
import { getInstrumentIcon, DEFAULT_INSTRUMENT_ICON } from '@/lib/production/instrument-icons'

describe('getInstrumentIcon', () => {
  it('mapeia Voz Masculina para o ícone de microfone/vocal', () => {
    expect(getInstrumentIcon('Voz Masculina')).toBe(MicVocal)
  })

  it('mapeia Voz Feminina para o ícone de microfone/vocal', () => {
    expect(getInstrumentIcon('Voz Feminina')).toBe(MicVocal)
  })

  it('mapeia Vocal para o ícone de microfone/vocal', () => {
    expect(getInstrumentIcon('Vocal')).toBe(MicVocal)
  })

  it('mapeia Bateria para o ícone de bateria', () => {
    expect(getInstrumentIcon('Bateria')).toBe(Drum)
  })

  it('mapeia Guitarra para o ícone de guitarra/violão', () => {
    expect(getInstrumentIcon('Guitarra')).toBe(Guitar)
  })

  it('mapeia Baixo para o ícone mais próximo (guitarra/violão)', () => {
    expect(getInstrumentIcon('Baixo')).toBe(Guitar)
  })

  it('mapeia Violão para o ícone de guitarra/violão', () => {
    expect(getInstrumentIcon('Violão')).toBe(Guitar)
  })

  it('mapeia Teclado para o ícone de teclas/piano', () => {
    expect(getInstrumentIcon('Teclado')).toBe(Piano)
  })

  it('mapeia Saxofone para um ícone de instrumento de sopro', () => {
    const icon = getInstrumentIcon('Saxofone')
    expect(icon).not.toBe(DEFAULT_INSTRUMENT_ICON)
  })

  it('mapeia Equipe de Som para o ícone de áudio/volume', () => {
    expect(getInstrumentIcon('Equipe de Som')).toBe(Volume2)
  })

  it('mapeia Cerimônia para o ícone de Sparkles', () => {
    expect(getInstrumentIcon('Cerimônia')).toBe(Sparkles)
  })

  it('função/instrumento sem mapeamento cai no ícone genérico de música (fallback)', () => {
    expect(getInstrumentIcon('Instrumento Totalmente Novo')).toBe(DEFAULT_INSTRUMENT_ICON)
    expect(DEFAULT_INSTRUMENT_ICON).toBe(Music)
  })

  it('instrumento nulo ou vazio usa o fallback, sem lançar erro', () => {
    expect(getInstrumentIcon(null)).toBe(DEFAULT_INSTRUMENT_ICON)
    expect(getInstrumentIcon(undefined)).toBe(DEFAULT_INSTRUMENT_ICON)
    expect(getInstrumentIcon('')).toBe(DEFAULT_INSTRUMENT_ICON)
  })

  it('é resiliente a maiúsculas/minúsculas e espaços nas pontas', () => {
    expect(getInstrumentIcon('BATERIA')).toBe(Drum)
    expect(getInstrumentIcon('  Bateria  ')).toBe(Drum)
    expect(getInstrumentIcon('bateria')).toBe(Drum)
  })

  it('todos os valores do seletor atual (InstrumentPicker) possuem mapeamento e nenhum lança erro', () => {
    const allInstruments = [
      'Acordeom', 'Piano', 'Teclado',
      'Backing Vocal', 'Vocal', 'Voz Feminina', 'Voz Masculina',
      'Baixo', 'Bandolim', 'Cavaquinho', 'Guitarra', 'Viola', 'Violão',
      'Bateria', 'Cajón', 'Percussão',
      'Flauta', 'Saxofone', 'Trombone', 'Trompete',
      'DJ', 'Equipe de Som', 'Técnico', 'Time AllMusic', 'Time Beats', 'Time SB', 'Cerimônia',
    ]
    for (const instrument of allInstruments) {
      expect(() => getInstrumentIcon(instrument)).not.toThrow()
      expect(getInstrumentIcon(instrument)).toBeDefined()
    }
  })

  it('instrumentos removidos do seletor continuam com ícone válido para registros históricos', () => {
    const removedButHistorical = [
      'Órgão', 'Sintetizador',
      'Baixo (Voz)', 'Barítono', 'Contralto', 'Soprano', 'Tenor',
      'Contrabaixo Acústico', 'Harpa', 'Ukulele', 'Violino', 'Violoncelo',
    ]
    for (const instrument of removedButHistorical) {
      expect(() => getInstrumentIcon(instrument)).not.toThrow()
      expect(getInstrumentIcon(instrument)).not.toBe(DEFAULT_INSTRUMENT_ICON)
    }
    expect(getInstrumentIcon('Órgão')).toBe(Piano)
    expect(getInstrumentIcon('Barítono')).toBe(MicVocal)
    expect(getInstrumentIcon('Violino')).toBe(Guitar)
  })
})
