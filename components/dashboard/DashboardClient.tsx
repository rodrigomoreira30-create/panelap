// components/dashboard/DashboardClient.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KpiCards } from './KpiCards'
import { LeadsByDayChart } from './LeadsByDayChart'
import { LeadsByStageChart } from './LeadsByStageChart'
import { UpcomingEvents } from './UpcomingEvents'

export type DashboardKpi = {
  leadsAbertos: number
  faturamentoPrevisto: number
  leadsNovos: number
}

export type LeadsByDayItem = { date: string; count: number }
export type LeadsByStageItem = { stage: string; count: number }

export type UpcomingEvent = {
  id: string
  clientName: string
  eventDate: string
  eventType: string
}

export type DashboardData = {
  kpi: DashboardKpi
  leadsByDay: LeadsByDayItem[]
  leadsByStage: LeadsByStageItem[]
  upcomingEvents: UpcomingEvent[]
}

async function fetchDashboard(bandSlug: string, days: number): Promise<DashboardData> {
  const res = await fetch(
    `/api/dashboard?bandSlug=${encodeURIComponent(bandSlug)}&days=${days}`
  )
  if (!res.ok) throw new Error('Falha ao carregar dashboard')
  const json = await res.json()
  return json.data
}

const PERIOD_OPTIONS = [
  { value: 7,  label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
]

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 bg-gray-200 rounded-lg" />
        <div className="h-24 bg-gray-200 rounded-lg" />
        <div className="h-24 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-64 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-gray-200 rounded-lg" />
        <div className="h-48 bg-gray-200 rounded-lg" />
      </div>
    </div>
  )
}

export function DashboardClient({ bandSlug }: { bandSlug: string }) {
  const [days, setDays] = useState(30)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', bandSlug, days],
    queryFn: () => fetchDashboard(bandSlug, days),
  })

  if (isLoading) return <DashboardSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-4 text-gray-500">
        <p>Não foi possível carregar o dashboard.</p>
        <button
          onClick={() => refetch()}
          className="text-sm underline hover:text-gray-700"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-1">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setDays(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              days === opt.value
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <KpiCards kpi={data!.kpi} />
      <LeadsByDayChart data={data!.leadsByDay} />
      <div className="grid grid-cols-2 gap-4">
        <LeadsByStageChart data={data!.leadsByStage} />
        <UpcomingEvents events={data!.upcomingEvents} />
      </div>
    </div>
  )
}
