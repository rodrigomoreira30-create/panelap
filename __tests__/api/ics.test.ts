/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
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
})
