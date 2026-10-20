// components/dashboard/KpiCards.tsx
import type { DashboardKpi } from './DashboardClient'
import { brl } from './FinanceCards'

type Props = { kpi: DashboardKpi }

export function KpiCards({ kpi }: Props) {
  // `scope` deixa claro quais indicadores seguem o período e quais são retratos atuais.
  const cards = [
    { label: 'Leads abertos',                 value: kpi.leadsAbertos.toString(),   accent: 'bg-blue-500',    scope: 'Atual' },
    { label: 'Leads novos no período',        value: kpi.leadsNovos.toString(),     accent: 'bg-violet-500',  scope: 'No período' },
    {
      label: 'Faturamento Previsto Atrações',
      value: brl(kpi.faturamentoPrevisto),
      accent: 'bg-emerald-500',
      scope: 'Todas as datas',
      // Previsão comercial: não é a "Receita prevista" do Financeiro e não segue o período.
      hint: 'Valor comercial das atrações (proposta do lead, menos desconto) de todos os eventos contratados ou em andamento. Não segue o período; difere da Receita prevista do Financeiro.',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-lg border p-5" title={'hint' in card ? card.hint : undefined}>
          <div className="flex items-center justify-between mb-4">
            <div className={`inline-flex h-1.5 w-8 rounded-full ${card.accent}`} />
            <span className="text-[11px] text-gray-400">{card.scope}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          {'hint' in card && <p className="text-[11px] text-gray-400 mt-1 leading-tight">Carteira comercial contratada — não é a receita prevista do Financeiro</p>}
        </div>
      ))}
    </div>
  )
}
