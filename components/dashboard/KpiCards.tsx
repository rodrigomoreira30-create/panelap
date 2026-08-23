// components/dashboard/KpiCards.tsx
import { TrendingUp, DollarSign, Clock } from 'lucide-react'
import type { DashboardKpi } from './DashboardClient'

type Props = { kpi: DashboardKpi }

function fmt(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function KpiCards({ kpi }: Props) {
  const pipelineCards = [
    { label: 'Leads abertos',        value: kpi.leadsAbertos.toString(), accent: 'bg-blue-500' },
    { label: 'Faturamento previsto',  value: fmt(kpi.faturamentoPrevisto), accent: 'bg-emerald-500' },
    { label: 'Leads novos no período', value: kpi.leadsNovos.toString(),  accent: 'bg-violet-500' },
  ]

  const recebimentoMesPct = kpi.previstMes > 0
    ? Math.round((kpi.recebidoMes / kpi.previstMes) * 100)
    : null

  return (
    <div className="space-y-4">
      {/* Cards do pipeline */}
      <div className="grid grid-cols-3 gap-4">
        {pipelineCards.map(card => (
          <div key={card.label} className="bg-white rounded-lg border p-5">
            <div className={`inline-flex h-1.5 w-8 rounded-full ${card.accent} mb-4`} />
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Cards de recebimento */}
      <div className="grid grid-cols-3 gap-4">
        {/* A receber - próximos 30 dias */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
              Próx. 30 dias
            </span>
            <Clock size={15} className="text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-orange-600">{fmt(kpi.aReceber30dias)}</p>
          <p className="text-sm text-gray-500 mt-1">A receber</p>
        </div>

        {/* Recebido no mês */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              Este mês
            </span>
            <DollarSign size={15} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-600">{fmt(kpi.recebidoMes)}</p>
          <p className="text-sm text-gray-500 mt-1">Recebido</p>
        </div>

        {/* Previsto no mês + % recebido */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Este mês
            </span>
            <TrendingUp size={15} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(kpi.previstMes)}</p>
          <p className="text-sm text-gray-500 mt-1">
            Previsto
            {recebimentoMesPct !== null && (
              <span className={`ml-2 font-medium ${recebimentoMesPct >= 100 ? 'text-green-600' : 'text-orange-500'}`}>
                {recebimentoMesPct}% recebido
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
