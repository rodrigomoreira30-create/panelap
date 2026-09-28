import { describe, it, expect, afterEach } from 'vitest'
import {
  formatCacheValue,
  getScheduleCutoffDate,
  groupScheduleByMonth,
} from '@/lib/production/musician-schedule'

function decimal(value: number) {
  // Simula um Prisma.Decimal, que expõe apenas toString() (Number() o converte via coerção)
  return { toString: () => String(value) }
}

describe('formatCacheValue', () => {
  it('formata um cachê cadastrado em reais, com 2 casas decimais', () => {
    expect(formatCacheValue(decimal(700))).toBe('700,00')
  })

  it('músico A e músico B com cachês diferentes formatam de forma independente', () => {
    expect(formatCacheValue(decimal(500))).toBe('500,00')
    expect(formatCacheValue(decimal(700))).toBe('700,00')
  })

  it('retorna null quando o cachê não está cadastrado (null)', () => {
    expect(formatCacheValue(null)).toBeNull()
  })

  it('retorna null quando o cachê é undefined', () => {
    expect(formatCacheValue(undefined)).toBeNull()
  })

  it('retorna null quando o cachê é zero — não deve exibir "R$ 0,00"', () => {
    expect(formatCacheValue(decimal(0))).toBeNull()
    expect(formatCacheValue(0)).toBeNull()
  })

  it('retorna null para valor negativo (dado inconsistente, nunca deveria acontecer, mas não deve quebrar)', () => {
    expect(formatCacheValue(decimal(-100))).toBeNull()
  })

  it('aceita number puro além de objeto tipo Decimal', () => {
    expect(formatCacheValue(300)).toBe('300,00')
  })

  it('formata valores com centavos corretamente', () => {
    expect(formatCacheValue(decimal(1234.5))).toBe('1.234,50')
  })
})

// event_date é gravado como data pura à meia-noite UTC (ex.: "2026-09-28" -> 2026-09-28T00:00:00.000Z,
// mesma convenção usada na Agenda/calendário). O corte da agenda individual precisa comparar
// contra essa mesma referência, não contra o instante exato de "agora".
const pureDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const ORIGINAL_TZ = process.env.TZ
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

describe('getScheduleCutoffDate — regra "hoje ou futuro" da agenda individual', () => {
  it('BUG PRINCIPAL: evento de hoje (28/09/2026) não é excluído mesmo às 15h', () => {
    const agora = new Date('2026-09-28T18:00:00.000Z') // 15:00 em horário de Brasília (UTC-3)
    const cutoff = getScheduleCutoffDate(agora)
    expect(pureDate('2026-09-28') >= cutoff).toBe(true)
  })

  it('evento de hoje continua aparecendo até o fim do dia (23:59 em Brasília)', () => {
    const agora = new Date('2026-09-29T02:59:00.000Z') // 23:59 de 28/09 em Brasília
    const cutoff = getScheduleCutoffDate(agora)
    expect(pureDate('2026-09-28') >= cutoff).toBe(true)
  })

  it('evento de ontem segue de fora (regra de passado inalterada)', () => {
    const agora = new Date('2026-09-28T18:00:00.000Z')
    const cutoff = getScheduleCutoffDate(agora)
    expect(pureDate('2026-09-27') >= cutoff).toBe(false)
  })

  it('evento de amanhã aparece normalmente', () => {
    const agora = new Date('2026-09-28T18:00:00.000Z')
    const cutoff = getScheduleCutoffDate(agora)
    expect(pureDate('2026-09-29') >= cutoff).toBe(true)
  })

  it('evento futuro distante aparece normalmente', () => {
    const agora = new Date('2026-09-28T18:00:00.000Z')
    const cutoff = getScheduleCutoffDate(agora)
    expect(pureDate('2026-10-11') >= cutoff).toBe(true)
  })

  it('virada de mês: 30/09 é "ontem" e 01/10 é "hoje"', () => {
    const agora = new Date('2026-10-01T15:00:00.000Z') // manhã de 01/10 em Brasília
    const cutoff = getScheduleCutoffDate(agora)
    expect(pureDate('2026-09-30') >= cutoff).toBe(false)
    expect(pureDate('2026-10-01') >= cutoff).toBe(true)
  })

  it('virada de ano: 31/12 é "ontem" e 01/01 é "hoje"', () => {
    const agora = new Date('2027-01-01T15:00:00.000Z')
    const cutoff = getScheduleCutoffDate(agora)
    expect(pureDate('2026-12-31') >= cutoff).toBe(false)
    expect(pureDate('2027-01-01') >= cutoff).toBe(true)
  })

  it('não depende do fuso do processo/servidor: mesmo resultado em qualquer TZ', () => {
    const agora = new Date('2026-09-28T18:00:00.000Z')
    const cutoffs = new Set<number>()
    for (const tz of ['UTC', 'America/New_York', 'America/Sao_Paulo', 'Asia/Tokyo', 'Pacific/Auckland']) {
      process.env.TZ = tz
      cutoffs.add(getScheduleCutoffDate(agora).getTime())
    }
    expect(cutoffs.size).toBe(1)
    expect(new Date([...cutoffs][0]!).toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })

  it('caso clássico de UTC vs. Brasil: 21h30 em São Paulo (já é o dia seguinte em UTC) ainda considera hoje o dia local', () => {
    const agora = new Date('2026-09-29T00:30:00.000Z') // 21:30 de 28/09 em Brasília
    const cutoff = getScheduleCutoffDate(agora)
    expect(pureDate('2026-09-28') >= cutoff).toBe(true) // evento de hoje (BR) continua aparecendo
    expect(cutoff.toISOString()).toBe('2026-09-28T00:00:00.000Z') // não adianta para o dia UTC (29/09)
  })
})

describe('groupScheduleByMonth — agrupamento por mês da agenda individual', () => {
  const item = (id: string, iso: string) => ({ id, event: { event_date: pureDate(iso) } })

  it('agrupa eventos do mesmo mês numa única entrada, na ordem recebida', () => {
    const groups = groupScheduleByMonth([
      item('a', '2026-09-28'),
      item('b', '2026-09-30'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map(i => i.id)).toEqual(['a', 'b'])
    expect(groups[0].label).toBe('SETEMBRO 2026')
  })

  it('separa em grupos quando o mês muda', () => {
    const groups = groupScheduleByMonth([
      item('a', '2026-09-28'),
      item('b', '2026-10-03'),
      item('c', '2026-10-11'),
    ])
    expect(groups.map(g => g.label)).toEqual(['SETEMBRO 2026', 'OUTUBRO 2026'])
    expect(groups[1].items.map(i => i.id)).toEqual(['b', 'c'])
  })

  it('virada de ano gera grupos separados e corretamente rotulados', () => {
    const groups = groupScheduleByMonth([
      item('a', '2026-12-31'),
      item('b', '2027-01-01'),
    ])
    expect(groups.map(g => g.label)).toEqual(['DEZEMBRO 2026', 'JANEIRO 2027'])
  })

  it('lista vazia gera nenhum grupo', () => {
    expect(groupScheduleByMonth([])).toEqual([])
  })
})
