import { describe, it, expect, afterEach } from 'vitest'
import {
  CALENDAR_COLORS,
  CLOSED_LEAD_STAGE,
  getCalendarEventColor,
  toDateKey,
  toLocalDate,
} from '@/lib/agenda/calendar-status'

// event_date é gravado como meia-noite UTC (data "pura"), ex.: 2026-09-26T00:00:00.000Z
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

// "Hoje" = 26/09/2026 ao meio-dia no fuso local do processo
const HOJE = new Date(2026, 8, 26, 12, 0, 0)

const ORIGINAL_TZ = process.env.TZ
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

describe('getCalendarEventColor — regra de prioridade', () => {
  it('CASO 1: evento futuro + fechado → azul', () => {
    expect(
      getCalendarEventColor({ date: d('2026-10-10'), leadStage: CLOSED_LEAD_STAGE, today: HOJE })
    ).toBe('blue')
  })

  it('CASO 2: evento hoje + fechado → azul', () => {
    expect(
      getCalendarEventColor({ date: d('2026-09-26'), leadStage: CLOSED_LEAD_STAGE, today: HOJE })
    ).toBe('blue')
  })

  it('CASO 3: evento futuro + não fechado → laranja', () => {
    expect(
      getCalendarEventColor({ date: d('2026-12-11'), leadStage: 'negotiation', today: HOJE })
    ).toBe('orange')
  })

  it('CASO 4: evento hoje + não fechado → laranja', () => {
    expect(
      getCalendarEventColor({ date: d('2026-09-26'), leadStage: 'proposal_sent', today: HOJE })
    ).toBe('orange')
  })

  it('CASO 5: evento passado + fechado → cinza', () => {
    expect(
      getCalendarEventColor({ date: d('2026-09-05'), leadStage: CLOSED_LEAD_STAGE, today: HOJE })
    ).toBe('gray')
  })

  it('CASO 6: evento passado + não fechado → cinza', () => {
    expect(
      getCalendarEventColor({ date: d('2026-09-25'), leadStage: 'new_lead', today: HOJE })
    ).toBe('gray')
  })

  it('CASO 7: sem evidência de fechamento (etapa ausente/desconhecida) e futuro → laranja, nunca cinza', () => {
    expect(getCalendarEventColor({ date: d('2026-11-01'), leadStage: undefined, today: HOJE })).toBe('orange')
    expect(getCalendarEventColor({ date: d('2026-11-01'), leadStage: '', today: HOJE })).toBe('orange')
    expect(
      getCalendarEventColor({ date: d('2026-11-01'), leadStage: 'stage_1780521553138', today: HOJE })
    ).toBe('orange')
  })

  it('data passada tem prioridade sobre qualquer status (contratado em 05/09, hoje 26/09 → cinza)', () => {
    expect(
      getCalendarEventColor({ date: d('2026-09-05'), leadStage: CLOSED_LEAD_STAGE, today: HOJE })
    ).toBe('gray')
  })

  it('o status do Event (ex.: "done" via Equipe OK) NÃO influencia a cor: futuro + lead fechado continua azul', () => {
    // Regressão da causa raiz: 55/56 eventos têm Event.status = "done" e ficavam cinza.
    expect(
      getCalendarEventColor({ date: d('2026-10-17'), leadStage: CLOSED_LEAD_STAGE, today: HOJE })
    ).toBe('blue')
  })

  it('aceita a data como string ISO (vinda do JSON da API)', () => {
    expect(
      getCalendarEventColor({ date: '2026-09-26T00:00:00.000Z', leadStage: CLOSED_LEAD_STAGE, today: HOJE })
    ).toBe('blue')
  })

  it('expõe as cores hex usadas nos cards e na legenda', () => {
    expect(CALENDAR_COLORS).toEqual({ blue: '#3b82f6', orange: '#f59e0b', gray: '#9ca3af' })
  })
})

describe('getCalendarEventColor — timezone (CASO 8)', () => {
  const zones = ['America/New_York', 'America/Sao_Paulo', 'America/Los_Angeles', 'UTC', 'Pacific/Auckland']

  for (const tz of zones) {
    it(`[${tz}] evento de hoje nunca é "passado", do início ao fim do dia local`, () => {
      process.env.TZ = tz
      const inicioDoDia = new Date(2026, 8, 26, 0, 1, 0)
      const fimDoDia = new Date(2026, 8, 26, 23, 59, 0)
      for (const today of [inicioDoDia, fimDoDia]) {
        expect(getCalendarEventColor({ date: d('2026-09-26'), leadStage: 'closed', today })).toBe('blue')
        expect(getCalendarEventColor({ date: d('2026-09-26'), leadStage: 'negotiation', today })).toBe('orange')
      }
    })

    it(`[${tz}] ontem é passado e amanhã não é, no fim do dia local`, () => {
      process.env.TZ = tz
      const fimDoDia = new Date(2026, 8, 26, 23, 59, 0)
      expect(getCalendarEventColor({ date: d('2026-09-25'), leadStage: 'closed', today: fimDoDia })).toBe('gray')
      expect(getCalendarEventColor({ date: d('2026-09-27'), leadStage: 'closed', today: fimDoDia })).toBe('blue')
    })

    it(`[${tz}] toLocalDate preserva o dia do calendário`, () => {
      process.env.TZ = tz
      const local = toLocalDate(d('2026-09-26'))
      expect([local.getFullYear(), local.getMonth() + 1, local.getDate()]).toEqual([2026, 9, 26])
      const fromString = toLocalDate('2026-09-26T00:00:00.000Z')
      expect([fromString.getFullYear(), fromString.getMonth() + 1, fromString.getDate()]).toEqual([2026, 9, 26])
    })
  }

  it('caso clássico do bug de UTC: 21h30 em Nova York (já é dia 27 em UTC) ainda é dia 26 → evento de hoje continua azul', () => {
    process.env.TZ = 'America/New_York'
    const today = new Date('2026-09-27T01:30:00.000Z') // 21:30 de 26/09 em NY
    expect(getCalendarEventColor({ date: d('2026-09-26'), leadStage: 'closed', today })).toBe('blue')
  })
})

describe('toDateKey', () => {
  it('usa o dia UTC gravado (não desloca por fuso)', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(toDateKey(d('2026-09-26'))).toBe('2026-09-26')
    expect(toDateKey('2026-09-26')).toBe('2026-09-26')
  })
})

describe('exemplos reais da agenda (dados de produção em 26/09/2026)', () => {
  // event_date e status do lead conforme consulta somente-leitura ao banco.
  // Todos os eventos estão com Event.status = "done" (botão "Equipe OK"), o que era a causa do cinza.
  const real = [
    { nome: 'Helena e João Pedro',    data: '2026-09-26', lead: 'closed', esperado: 'blue' },
    { nome: 'Mariah & Cesar',         data: '2026-09-26', lead: 'closed', esperado: 'blue' },
    { nome: 'Antonio',                data: '2026-09-19', lead: 'closed', esperado: 'gray' },
    { nome: 'Gabi e Murilo',          data: '2026-09-05', lead: 'closed', esperado: 'gray' },
    { nome: 'Dayane',                 data: '2026-09-06', lead: 'closed', esperado: 'gray' },
    { nome: 'Juliana & Jean',         data: '2026-09-12', lead: 'closed', esperado: 'gray' },
    { nome: 'Giovanna e Guilherme',   data: '2026-09-12', lead: 'closed', esperado: 'gray' },
    { nome: 'QUALITYCERT (28/09)',    data: '2026-09-28', lead: 'closed', esperado: 'blue' },
    { nome: 'Siemens (lead aberto)',  data: '2026-12-11', lead: 'new_lead', esperado: 'orange' },
  ]

  for (const r of real) {
    it(`${r.nome} → ${r.esperado}`, () => {
      expect(getCalendarEventColor({ date: d(r.data), leadStage: r.lead, today: HOJE })).toBe(r.esperado)
    })
  }
})
