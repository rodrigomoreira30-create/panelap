import { describe, it, expect, afterEach } from 'vitest'
import {
  formatCacheValue,
  getScheduleCutoffDate,
  groupScheduleByMonth,
  isSoundTeamInstrument,
  getVisibleEventNotes,
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

// ── Alinhamentos do Evento na agenda individual: só para "Equipe de Som" ────────────────
describe('isSoundTeamInstrument — a permissão é pela função NAQUELE evento, não pelo cadastro do músico', () => {
  it('reconhece a grafia exata usada na Formação ("Equipe de Som")', () => {
    expect(isSoundTeamInstrument('Equipe de Som')).toBe(true)
  })

  it('é tolerante a maiúsculas/minúsculas e espaços, como já é feito para o ícone do instrumento', () => {
    expect(isSoundTeamInstrument('equipe de som')).toBe(true)
    expect(isSoundTeamInstrument('EQUIPE DE SOM')).toBe(true)
    expect(isSoundTeamInstrument('  Equipe de Som  ')).toBe(true)
  })

  it.each([
    'Voz Masculina', 'Voz Feminina', 'Bateria', 'Baixo', 'Guitarra', 'Teclado', 'DJ', 'Time SB', 'Técnico', 'Cerimônia',
  ])('TESTE 2: não reconhece outras funções da Formação (%s)', instrument => {
    expect(isSoundTeamInstrument(instrument)).toBe(false)
  })

  it('não reconhece instrumento nulo/ausente (vaga aberta)', () => {
    expect(isSoundTeamInstrument(null)).toBe(false)
    expect(isSoundTeamInstrument(undefined)).toBe(false)
  })

  it('TESTE 4: o mesmo músico (Tyago) é Equipe de Som no Evento A e outra função no Evento B — a função decide, não a pessoa', () => {
    const tyagoNoEventoA = 'Equipe de Som'
    const tyagoNoEventoB = 'Técnico'
    expect(isSoundTeamInstrument(tyagoNoEventoA)).toBe(true)
    expect(isSoundTeamInstrument(tyagoNoEventoB)).toBe(false)
  })
})

describe('getVisibleEventNotes — o que a agenda individual recebe para "Alinhamentos do Evento"', () => {
  const ALINHAMENTO_REAL =
    '<p>Tudo pronto as 15h00<br>Pode montar um dia antes<br>Local: Haras Lima em Limeira</p>'

  it('TESTE 1: Equipe de Som com alinhamentos preenchidos → recebe o conteúdo', () => {
    expect(getVisibleEventNotes('Equipe de Som', ALINHAMENTO_REAL)).toBe(ALINHAMENTO_REAL)
  })

  it.each(['Voz Masculina', 'Bateria', 'Guitarra', 'Baixo', 'Teclado', 'DJ', 'Time SB'])(
    'TESTE 2: %s não recebe os alinhamentos, mesmo havendo conteúdo preenchido',
    instrument => {
      expect(getVisibleEventNotes(instrument, ALINHAMENTO_REAL)).toBeNull()
    }
  )

  it('TESTE 3: Equipe de Som sem alinhamentos preenchidos → não mostra seção (retorna null, não string vazia)', () => {
    expect(getVisibleEventNotes('Equipe de Som', null)).toBeNull()
    expect(getVisibleEventNotes('Equipe de Som', '')).toBeNull()
    expect(getVisibleEventNotes('Equipe de Som', '<p></p>')).toBeNull()
  })

  it('TESTE 4: o mesmo conteúdo só é liberado para a atribuição "Equipe de Som" — simula Tyago no Evento A e no Evento B', () => {
    expect(getVisibleEventNotes('Equipe de Som', ALINHAMENTO_REAL)).toBe(ALINHAMENTO_REAL) // Evento A
    expect(getVisibleEventNotes('Técnico', ALINHAMENTO_REAL)).toBeNull()                    // Evento B
  })

  it('TESTE 5: refletir uma atualização da Produção é automático — a função sempre lê o notes recebido, sem cache', () => {
    const atualizado = '<p>Novo horário: chegar às 16h</p>'
    expect(getVisibleEventNotes('Equipe de Som', atualizado)).toBe(atualizado)
  })

  it('preserva formatação rica (negrito e lista) sem alteração — quem renderiza decide a exibição, não esta função', () => {
    const html = '<ul><li><strong>Som</strong>: ligar às 14h</li></ul>'
    expect(getVisibleEventNotes('Equipe de Som', html)).toBe(html)
  })
})
