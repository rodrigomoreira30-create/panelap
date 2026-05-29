'use client'

import { useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EventPopover } from './EventPopover'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { 'pt-BR': ptBR }

const localizer = dateFnsLocalizer({
  format,
  parse: (value: string, formatStr: string, baseDate: Date) =>
    parse(value, formatStr, baseDate),
  startOfWeek: (date: Date) => startOfWeek(date, { locale: ptBR }),
  getDay,
  locales,
})

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: { status: string; type: string; musicians: string[] }
}

interface CalendarViewProps {
  initialEvents: CalendarEvent[]
}

export function CalendarView({ initialEvents }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
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
        setEvents(
          data.map((e: CalendarEvent & { start: string; end: string }) => ({
            ...e,
            start: new Date(e.start),
            end: new Date(e.end),
          }))
        )
      }
    } finally {
      setLoading(false)
    }
  }

  function handleNavigate(date: Date) {
    setCurrentDate(date)
    loadMonth(date)
  }

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors: Record<string, string> = {
      contracted: '#3b82f6',
      active:     '#f97316',
      done:       '#9ca3af',
    }
    return {
      style: {
        backgroundColor: colors[event.resource.status] ?? '#6b7280',
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
        events={events}
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
        components={{
          event: ({ event }: { event: object }) => {
            const calEvent = event as CalendarEvent
            return (
              <Popover>
                <PopoverTrigger asChild>
                  <span className="block truncate cursor-pointer">{calEvent.title}</span>
                </PopoverTrigger>
                <PopoverContent>
                  <EventPopover event={calEvent} />
                </PopoverContent>
              </Popover>
            )
          },
        }}
      />
    </div>
  )
}
