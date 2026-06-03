export type ICSEvent = {
  id: string
  client_name: string
  event_type: string
  event_date: Date
  event_time: string | null
  venue_name: string
  venue_address: string | null
  status: string
}

const eventTypeLabels: Record<string, string> = {
  wedding:   'Casamento',
  party:     'Festa',
  show:      'Show',
  corporate: 'Corporativo',
  other:     'Outro',
}

const statusLabels: Record<string, string> = {
  pending:   'Pendente',
  confirmed: 'Confirmado',
  declined:  'Recusou',
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatDTSTART(date: Date, time: string | null): { prop: string; value: string } {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  if (time) {
    const [h, min = '00'] = time.split(':')
    return { prop: 'DTSTART', value: `${y}${m}${d}T${h.padStart(2, '0')}${min.padStart(2, '0')}00` }
  }
  return { prop: 'DTSTART;VALUE=DATE', value: `${y}${m}${d}` }
}

export function generateICS(musicianName: string, events: ICSEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PanelAp//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(musicianName)} — Agenda`,
  ]

  // RFC 5545: DTSTAMP é obrigatório, usa timestamp UTC atual
  const now = new Date()
  const dtstamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('') + 'T' + [
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('') + 'Z'

  for (const ev of events) {
    const { prop, value } = formatDTSTART(ev.event_date, ev.event_time)
    const summary  = escapeICS(`${ev.client_name} - ${eventTypeLabels[ev.event_type] ?? ev.event_type}`)
    const location = ev.venue_address
      ? escapeICS(`${ev.venue_name}, ${ev.venue_address}`)
      : escapeICS(ev.venue_name)
    const description = escapeICS(`Status: ${statusLabels[ev.status] ?? ev.status}`)

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id.replace(/[\r\n]/g, '')}@panelap`,
      `DTSTAMP:${dtstamp}`,
      `SUMMARY:${summary}`,
      `${prop}:${value}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
