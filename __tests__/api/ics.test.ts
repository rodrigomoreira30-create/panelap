/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest'
import { generateICS } from '@/lib/ics'

describe('generateICS', () => {
  it('gera ICS válido com um evento sem horário', () => {
    const result = generateICS('João Silva', [
      {
        id: 'em-1',
        client_name: 'Maria Santos',
        event_type: 'wedding',
        event_date: new Date('2026-08-15T00:00:00.000Z'),
        event_time: null,
        venue_name: 'Buffet das Flores',
        venue_address: null,
        status: 'confirmed',
      },
    ])
    expect(result).toContain('BEGIN:VCALENDAR')
    expect(result).toContain('BEGIN:VEVENT')
    expect(result).toContain('SUMMARY:Maria Santos - Casamento')
    expect(result).toContain('DTSTART;VALUE=DATE:20260815')
    expect(result).toContain('LOCATION:Buffet das Flores')
    expect(result).toContain('UID:em-1@panelap')
    expect(result).toContain('DESCRIPTION:Status: Confirmado')
    expect(result).toContain('END:VEVENT')
    expect(result).toContain('END:VCALENDAR')
  })

  it('inclui horário quando event_time está presente', () => {
    const result = generateICS('João Silva', [
      {
        id: 'em-2',
        client_name: 'Carlos',
        event_type: 'show',
        event_date: new Date('2026-09-20T00:00:00.000Z'),
        event_time: '20:00',
        venue_name: 'Teatro Municipal',
        venue_address: 'Rua das Flores, 100',
        status: 'pending',
      },
    ])
    expect(result).toContain('DTSTART:20260920T200000')
    expect(result).toContain('DESCRIPTION:Status: Pendente')
  })

  it('gera ICS válido com lista vazia', () => {
    const result = generateICS('João Silva', [])
    expect(result).toContain('BEGIN:VCALENDAR')
    expect(result).not.toContain('BEGIN:VEVENT')
    expect(result).toContain('END:VCALENDAR')
  })

  it('exibe label correto para status declined', () => {
    const result = generateICS('João', [
      {
        id: 'em-3',
        client_name: 'Ana',
        event_type: 'party',
        event_date: new Date('2026-10-01T00:00:00.000Z'),
        event_time: null,
        venue_name: 'Salão',
        venue_address: null,
        status: 'declined',
      },
    ])
    expect(result).toContain('DESCRIPTION:Status: Recusou')
  })

  it('usa CRLF como separador de linhas', () => {
    const result = generateICS('Teste', [])
    expect(result).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0')
  })
})

// ── GET /api/ics/[token] — mesma regra "hoje ou futuro" da agenda individual ─────
describe('GET /api/ics/[token]', () => {
  it('filtra por getScheduleCutoffDate (não pelo instante exato de "agora"): evento de hoje não é excluído', async () => {
    vi.resetModules()
    vi.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: vi.fn().mockResolvedValue({ name: 'André', event_musicians: [] }) } },
    }))

    const { GET } = await import('@/app/api/ics/[token]/route')
    const { prisma } = await import('@/lib/prisma')
    const { getScheduleCutoffDate } = await import('@/lib/production/musician-schedule')

    await GET(new Request('http://localhost/api/ics/tok'), { params: Promise.resolve({ token: 'tok' }) })

    const call = vi.mocked(prisma.user.findUnique).mock.calls[0][0] as any
    const usedCutoff: Date = call.select.event_musicians.where.event.event_date.gte
    // getScheduleCutoffDate() sem argumento usa o "agora" real — comparamos com uma
    // chamada feita no mesmo instante do teste (a granularidade é o dia, não o milissegundo).
    expect(usedCutoff.toISOString()).toBe(getScheduleCutoffDate().toISOString())
    expect(usedCutoff.getUTCHours()).toBe(0) // meia-noite UTC — nunca o instante exato de "agora"

    vi.doUnmock('@/lib/prisma')
  })
})
