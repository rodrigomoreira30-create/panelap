// Regra única de cor dos cards da Agenda.
//
// Prioridade:
//   1. data anterior a hoje            → cinza  (sobrepõe qualquer status)
//   2. hoje/futuro + lead fechado      → azul   (evento contratado)
//   3. hoje/futuro + qualquer outro    → laranja (orçamento em aberto)
//
// "Fechado" é a etapa do LEAD no pipeline (Lead.status === 'closed'), não a existência de
// um Event nem o Event.status: o botão "Equipe OK" da Produção grava Event.status = 'done'
// para arquivar o evento, então esse campo não diz se o evento já aconteceu.

export type CalendarColor = 'gray' | 'blue' | 'orange'

// Chave da etapa "Fechado" — a mesma que dispara a criação do Event (lead.closed).
export const CLOSED_LEAD_STAGE = 'closed'

export const CALENDAR_COLORS: Record<CalendarColor, string> = {
  blue:   '#3b82f6',
  orange: '#f59e0b',
  gray:   '#9ca3af',
}

/**
 * Dia do calendário ('YYYY-MM-DD') de uma data gravada no banco. event_date é uma data
 * "pura" gravada à meia-noite UTC, então o dia vem do valor UTC — sem converter pelo fuso.
 */
export function toDateKey(v: Date | string): string {
  const iso = v instanceof Date ? v.toISOString() : v
  return iso.slice(0, 10)
}

/** Dia local de "agora" ('YYYY-MM-DD'), no fuso de quem está vendo o calendário. */
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data local (meia-noite) com o mesmo dia do calendário, para o react-big-calendar. */
export function toLocalDate(v: Date | string): Date {
  const [y, m, d] = toDateKey(v).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getCalendarEventColor({
  date,
  leadStage,
  today = new Date(),
}: {
  date: Date | string
  leadStage?: string | null
  today?: Date
}): CalendarColor {
  // Datas 'YYYY-MM-DD' comparam corretamente como string. Hoje não é passado.
  if (toDateKey(date) < localDateKey(today)) return 'gray'
  if (leadStage === CLOSED_LEAD_STAGE) return 'blue'
  return 'orange'
}
