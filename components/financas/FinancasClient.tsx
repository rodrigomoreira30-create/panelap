'use client'

import { useState, useCallback } from 'react'
import { MonthSelector } from './MonthSelector'
import { SummaryCards } from './SummaryCards'
import { FinanceTable } from './FinanceTable'
import { AddShowModal } from './AddShowModal'
import type { EventFinanceData } from '@/lib/financas'

interface AvailableEvent {
  id: string
  client_name: string
  event_date: string
}

interface FinancasClientProps {
  bandSlug: string
  initialFinances: EventFinanceData[]
  initialAvailableEvents: AvailableEvent[]
  initialMonth: number
  initialYear: number
}

export function FinancasClient({
  bandSlug: _bandSlug,
  initialFinances,
  initialAvailableEvents,
  initialMonth,
  initialYear,
}: FinancasClientProps) {
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [finances, setFinances] = useState<EventFinanceData[]>(initialFinances)
  const [availableEvents, setAvailableEvents] = useState<AvailableEvent[]>(initialAvailableEvents)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const loadMonth = useCallback(async (m: number, y: number) => {
    setLoading(true)
    const [financesRes, eventsRes] = await Promise.all([
      fetch(`/api/financas?month=${m}&year=${y}`),
      fetch(`/api/events?noFinance=true&month=${m}&year=${y}`),
    ])
    if (financesRes.ok) {
      const data = await financesRes.json()
      setFinances(data.data ?? [])
    }
    if (eventsRes.ok) {
      const data = await eventsRes.json()
      setAvailableEvents(data.data ?? [])
    } else {
      setAvailableEvents([])
    }
    setLoading(false)
  }, [])

  function handleMonthChange(m: number, y: number) {
    setMonth(m)
    setYear(y)
    loadMonth(m, y)
  }

  function handleFinanceAdded(finance: EventFinanceData) {
    setFinances(prev =>
      [...prev, finance].sort(
        (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      )
    )
    if (finance.event_id) {
      setAvailableEvents(prev => prev.filter(e => e.id !== finance.event_id))
    }
    setShowModal(false)
  }

  function handleFinanceUpdated(updated: EventFinanceData) {
    setFinances(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  function handleFinanceDeleted(id: string) {
    setFinances(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanças</h1>
          <p className="text-gray-500 text-sm">Controle financeiro por show</p>
        </div>
        <div className="flex items-center gap-4">
          <MonthSelector month={month} year={year} onChange={handleMonthChange} />
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            + Adicionar show
          </button>
        </div>
      </div>

      <SummaryCards finances={finances} />

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm animate-pulse">
          Carregando...
        </div>
      ) : finances.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2 border rounded-lg bg-white">
          <p className="text-sm">Nenhum show financeiro neste mês.</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            Adicionar show
          </button>
        </div>
      ) : (
        <FinanceTable
          finances={finances}
          onFinanceUpdated={handleFinanceUpdated}
          onFinanceDeleted={handleFinanceDeleted}
        />
      )}

      {showModal && (
        <AddShowModal
          availableEvents={availableEvents}
          month={month}
          year={year}
          onAdded={handleFinanceAdded}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
