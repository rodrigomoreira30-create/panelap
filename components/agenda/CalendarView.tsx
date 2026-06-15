'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { 'pt-BR': ptBR }

function toLocalDate(v: Date | string): Date {
  const iso = v instanceof Date ? v.toISOString() : v
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

const localizer = dateFnsLocalizer({
  format,
  parse: (value: string, formatStr: string, baseDate: Date) =>
    parse(value, formatStr, baseDate),
  startOfWeek: (date: Date) => startOfWeek(date, { locale: ptBR }),
  getDay,
  locales,
})

export type CalendarItem = {
  id: string
  title: string
  start: Date
  end: Date
  resource: {
    kind: 'event' | 'lead'
    status: string
    eventType: string
    venue: string | null
    musicians: string[]
  }
}

interface CalendarViewProps {
  initialEvents: CalendarItem[]
  bandSlug: string
}

export function CalendarView({ initialEvents, bandSlug }: CalendarViewProps) {
  const router = useRouter()
  const [items, setItems] = useState<CalendarItem[]>(
    initialEvents.map(e => ({ ...e, start: toLocalDate(e.start), end: toLocalDate(e.end) }))
  )
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('month')
  const [loading, setLoading] = useState(false)

  async function loadMonth(date: Date) {
    setLoading(true)
    try {
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const res = await fetch(`/api/agenda?year=${year}&month=${month}`)
      if (res.ok) {
        const { data } = await res.json()
        setItems(
          data.map((e: CalendarItem & { start: string; end: string }) => ({
            ...e,
            start: toLocalDate(e.start),
            end: toLocalDate(e.end),
          }))
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMonth(currentDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleNavigate(date: Date) {
    setCurrentDate(date)
    loadMonth(date)
  }

  const eventStyleGetter = useCallback((item: CalendarItem) => {
    const isLead = item.resource.kind === 'lead'

    const eventColors: Record<string, string> = {
      contracted: '#3b82f6',
      active:     '#f97316',
      done:       '#9ca3af',
    }

    const bg = isLead
      ? '#f59e0b'
      : (eventColors[item.resource.status] ?? '#6b7280')

    return {
      style: {
        backgroundColor: bg,
        borderRadius: '4px',
        border: 'none',
        color: 'white',
        fontSize: '12px',
        padding: '1px 4px',
      },
    }
  }, [])

  return (
    <div className={`h-[600px] transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
      <Calendar
        localizer={localizer}
        events={items}
        view={view}
        onView={(v: View) => setView(v)}
        date={currentDate}
        onNavigate={handleNavigate}
        culture="pt-BR"
        messages={{
          next: 'Próximo',
          previous: 'Anterior',
          today: 'Hoje',
          month: 'Mês',
          week: 'Semana',
          day: 'Dia',
          agenda: 'Lista',
        }}
        eventPropGetter={eventStyleGetter}
        onSelectEvent={(item) => {
          if (item.resource.kind === 'lead') {
            router.push(`/${bandSlug}/comercial/${item.id}`)
          } else {
            router.push(`/${bandSlug}/producao/${item.id}`)
          }
        }}
        components={{
          event: ({ event }: { event: object }) => {
            const item = event as CalendarItem
            return (
              <span className="block truncate cursor-pointer">{item.title}</span>
            )
          },
        }}
      />
    </div>
  )
}
