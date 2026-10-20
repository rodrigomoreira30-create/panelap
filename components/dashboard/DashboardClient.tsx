// components/dashboard/DashboardClient.tsx
'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { KpiCards } from './KpiCards'
import { LeadsByDayChart } from './LeadsByDayChart'
import { LeadsByStageChart } from './LeadsByStageChart'
import { UpcomingEvents } from './UpcomingEvents'
import { FinanceCards } from './FinanceCards'
import { FinanceEvolutionChart } from './FinanceEvolutionChart'
import { DEFAULT_PRESET, PeriodFilter, selectionForPreset, type PeriodSelection } from './PeriodFilter'
import { formatPeriodLabel, type AnalysisCriterion, type Granularity } from '@/lib/dashboard-period'

/** Indicadores que não dependem do período selecionado (exceto leadsNovos). */
export type DashboardKpi = {
  leadsAbertos: number
  faturamentoPrevisto: number
  leadsNovos: number
}

export type DashboardFinance =
  | {
      criterion: 'evento'
      faturamentoPrevisto: number
      recebido: number
      aReceber: number
      custos: number
      lucroPrevisto: number
      margemPrevista: number | null
      percentualRecebido: number | null
      eventos: number
      cancelados: { count: number; faturamentoPrevisto: number }
    }
  | {
      criterion: 'recebimento'
      recebido: number
      pagamentos: number
      eventos: number
      semData: { count: number; valor: number }
    }

export type FinanceEvolutionItem =
  | { key: string; label: string; faturamento: number; custos: number; lucro: number }
  | { key: string; label: string; recebido: number }

export type LeadsByDayItem = { key: string; label: string; count: number }
export type LeadsByStageItem = { stage: string; count: number }

export type UpcomingEvent = {
  id: string
  clientName: string
  eventDate: string
  eventType: string
}

export type DashboardData = {
  period: { from: string; to: string; granularity: Granularity; criterion: AnalysisCriterion }
  kpi: DashboardKpi
  finance: DashboardFinance
  financeEvolution: FinanceEvolutionItem[]
  leadsByPeriod: LeadsByDayItem[]
  leadsByStage: LeadsByStageItem[]
  upcomingEvents: UpcomingEvent[]
}

async function fetchDashboard(bandSlug: string, sel: PeriodSelection): Promise<DashboardData> {
  const params = new URLSearchParams({ bandSlug, from: sel.from, to: sel.to, criterio: sel.criterion })
  const res = await fetch(`/api/dashboard?${params}`)
  if (!res.ok) throw new Error('Falha ao carregar dashboard')
  const json = await res.json()
  return json.data
}

const PRESET_LABEL: Record<PeriodSelection['preset'], string> = {
  '7d': 'Últimos 7 dias (até hoje)',
  '30d': 'Últimos 30 dias (até hoje)',
  '90d': 'Últimos 90 dias (até hoje)',
  month: 'Este mês',
  year: 'Este ano',
  custom: 'Personalizado',
}

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
  const [selection, setSelection] = useState<PeriodSelection>(() =>
    selectionForPreset(DEFAULT_PRESET, 'evento'),
  )

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['dashboard', bandSlug, selection.from, selection.to, selection.criterion],
    queryFn: () => fetchDashboard(bandSlug, selection),
    // Mantém o painel na tela enquanto o novo período carrega (sem piscar o skeleton).
    placeholderData: keepPreviousData,
  })

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Período selecionado</p>
        <p className="text-sm font-medium text-gray-900">
          {PRESET_LABEL[selection.preset]} · {formatPeriodLabel(selection.from, selection.to)}
          {isFetching && !isLoading && <span className="ml-2 text-xs font-normal text-gray-400">atualizando…</span>}
        </p>
      </div>
      <PeriodFilter value={selection} onChange={setSelection} />
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <DashboardSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex flex-col items-center justify-center h-48 gap-4 text-gray-500">
          <p>Não foi possível carregar o dashboard.</p>
          <button
            onClick={() => refetch()}
            className="text-sm underline hover:text-gray-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}
      <KpiCards kpi={data.kpi} />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">
          Indicadores financeiros
          <span className="ml-2 text-xs font-normal text-gray-400">
            {data.period.criterion === 'evento' ? 'eventos com data' : 'recebimentos com data'} de{' '}
            {formatPeriodLabel(data.period.from, data.period.to)}
          </span>
        </h2>
        <FinanceCards finance={data.finance} />
      </section>
      <FinanceEvolutionChart
        data={data.financeEvolution}
        granularity={data.period.granularity}
        criterion={data.period.criterion}
      />
      <LeadsByDayChart data={data.leadsByPeriod} granularity={data.period.granularity} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LeadsByStageChart data={data.leadsByStage} />
        <UpcomingEvents events={data.upcomingEvents} />
      </div>
    </div>
  )
}
