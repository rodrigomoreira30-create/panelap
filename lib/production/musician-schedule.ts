import { format } from 'date-fns'
// Subpath específico (não o barrel `date-fns/locale`, que reexporta ~200 locales e trava
// a coleta de testes do Vitest neste projeto/ambiente) — mesmo export `ptBR`, sem mudança
// de comportamento.
import { ptBR } from 'date-fns/locale/pt-BR'
import { normalizeNotesContent } from './alignment-notes'

/** Formata o cachê de uma atribuição (`EventMusician.cache_value`) para exibição
 * na agenda individual do músico. Retorna `null` quando não há valor cadastrado
 * (null/undefined) ou quando o valor é zero — nesses casos a linha de cachê deve
 * ficar oculta no card, em vez de mostrar "Cachê: R$ 0,00". */
export function formatCacheValue(
  cacheValue: { toString(): string } | number | null | undefined
): string | null {
  if (cacheValue == null) return null
  const n = Number(cacheValue)
  if (!(n > 0)) return null
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// A aplicação é operada no Brasil: os formulários de lead/evento gravam `event_date` como
// data pura à meia-noite UTC do dia escolhido pelo usuário (ex.: input "2026-09-28" vira
// 2026-09-28T00:00:00.000Z — mesma convenção da Agenda/calendário, ver lib/agenda/calendar-status.ts).
// "Hoje", aqui, precisa ser o dia corrente NESSE fuso — nunca o fuso do processo/servidor
// (o Node em produção roda em UTC), senão um evento de hoje pode "virar passado" horas antes
// da meia-noite no Brasil, ou "virar futuro" horas depois, conforme a hora do servidor.
const SCHEDULE_TIMEZONE = 'America/Sao_Paulo'

/** Início do dia de "hoje" no fuso do Brasil, no mesmo formato em que `event_date` é
 *  gravado (meia-noite UTC do dia civil). Um evento aparece na agenda individual do
 *  músico e na exportação para o Google Calendar quando `event_date >= getScheduleCutoffDate()`:
 *  eventos de hoje e futuros aparecem; eventos de dias anteriores, não. */
export function getScheduleCutoffDate(now: Date = new Date()): Date {
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) // 'YYYY-MM-DD', independente do fuso do processo (TZ explícito acima)
  return new Date(`${todayKey}T00:00:00.000Z`)
}

export type ScheduleMonthGroup<T> = { key: string; label: string; items: T[] }

/** Agrupa os itens da agenda individual por mês do `event_date`, mantendo a ordem
 *  recebida (a lista já vem ordenada por data). Os itens já devem estar filtrados por
 *  `getScheduleCutoffDate` — esta função só agrupa, não filtra. */
export function groupScheduleByMonth<T extends { event: { event_date: Date } }>(
  items: T[]
): ScheduleMonthGroup<T>[] {
  const groups: ScheduleMonthGroup<T>[] = []
  for (const item of items) {
    const [y, m] = item.event.event_date.toISOString().slice(0, 7).split('-').map(Number)
    const key = `${y}-${m}`
    const label = format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: ptBR }).toUpperCase()
    const last = groups[groups.length - 1]
    if (last?.key === key) {
      last.items.push(item)
    } else {
      groups.push({ key, label, items: [item] })
    }
  }
  return groups
}

// "Equipe de Som" é o valor exato de EventMusician.instrument usado pela Formação
// (ver components/producao/InstrumentPicker.tsx, categoria "Outros"). A comparação é
// tolerante a maiúsculas/espaços, como já é feito em lib/production/instrument-icons.ts
// para resolver o ícone do instrumento.
const SOUND_TEAM_INSTRUMENT = 'equipe de som'

/** `true` quando a atribuição ocupa a função "Equipe de Som" NAQUELE evento — é a única
 *  função que vê os Alinhamentos do Evento na agenda individual. A regra é por evento,
 *  não por cadastro do músico: a mesma pessoa pode estar em "Equipe de Som" num evento e
 *  em outra função noutro, e esta função só enxerga o `instrument` da atribuição atual. */
export function isSoundTeamInstrument(instrument: string | null | undefined): boolean {
  return (instrument ?? '').trim().toLowerCase() === SOUND_TEAM_INSTRUMENT
}

/** Alinhamentos do Evento a expor na agenda individual: só para quem está em "Equipe de
 *  Som" nesta atribuição, e só quando o conteúdo não está vazio (nunca mostra a seção em
 *  branco). É a barreira que impede o conteúdo de vazar para outras funções — mesmo que a
 *  consulta ao banco traga `event.notes` para todas as atribuições do evento, a página só
 *  deve interpolar no HTML enviado ao navegador o valor que esta função devolver. */
export function getVisibleEventNotes(
  instrument: string | null | undefined,
  notes: string | null | undefined
): string | null {
  if (!isSoundTeamInstrument(instrument)) return null
  return normalizeNotesContent(notes ?? '') || null
}
