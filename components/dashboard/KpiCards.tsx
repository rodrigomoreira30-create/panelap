// components/dashboard/KpiCards.tsx
import type { DashboardKpi } from './DashboardClient'

type Props = { kpi: DashboardKpi }

export function KpiCards({ kpi }: Props) {
  const cards = [
    {
      label: 'Leads abertos',
      value: kpi.leadsAbertos.toString(),
      accent: 'bg-blue-500',
    },
    {
      label: 'Faturamento',
      value: `R$ ${kpi.faturamentoPrevisto.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      accent: 'bg-emerald-500',
    },
    {
      label: 'Leads novos no período',
      value: kpi.leadsNovos.toString(),
      accent: 'bg-violet-500',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-lg border p-5">
          <div className={`inline-flex h-1.5 w-8 rounded-full ${card.accent} mb-4`} />
          <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          <p className="text-sm text-gray-500 mt-1">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
