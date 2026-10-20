// components/dashboard/FinanceCards.tsx
import { AlertTriangle, Info } from 'lucide-react'
import type { DashboardFinance } from './DashboardClient'

export function brl(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function pct(value: number) {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

type Card = { label: string; value: string; hint: string; color: string }

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-lg border p-4" title={card.hint}>
          <p className="text-xs text-gray-500 mb-1">{card.label}</p>
          <p className={`text-lg font-bold leading-snug ${card.color}`}>{card.value}</p>
          <p className="text-[11px] text-gray-400 mt-1 leading-tight">{card.hint}</p>
        </div>
      ))}
    </div>
  )
}

export function FinanceCards({ finance }: { finance: DashboardFinance }) {
  if (finance.criterion === 'recebimento') {
    return (
      <div className="space-y-3">
        <CardGrid
          cards={[
            {
              label: 'Recebido no período',
              value: brl(finance.recebido),
              hint: 'Soma dos pagamentos registrados, pela data real de cada recebimento',
              color: 'text-green-700',
            },
            {
              label: 'Pagamentos',
              value: finance.pagamentos.toString(),
              hint: 'Recebimentos lançados no período',
              color: 'text-gray-900',
            },
            {
              label: 'Eventos pagantes',
              value: finance.eventos.toString(),
              hint: 'Eventos com ao menos um recebimento no período',
              color: 'text-gray-900',
            },
          ]}
        />
        <p className="flex items-start gap-1.5 text-xs text-gray-500">
          <Info size={13} className="mt-0.5 shrink-0" />
          Faturamento previsto, custos e lucro são indicadores por data do evento — selecione
          &quot;Data do evento&quot; para vê-los.
        </p>
        {finance.semData.count > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {finance.semData.count} evento(s) têm {brl(finance.semData.valor)} recebidos lançados
            sem data (valor manual antigo, sem histórico de pagamentos). Esses valores não entram
            neste critério; registre os pagamentos no Financeiro do evento para incluí-los.
          </p>
        )}
      </div>
    )
  }

  const profitColor = finance.lucroPrevisto >= 0 ? 'text-green-700' : 'text-red-600'
  return (
    <div className="space-y-3">
      <CardGrid
        cards={[
          {
            label: 'Receita prevista',
            value: brl(finance.faturamentoPrevisto),
            hint: 'Soma das receitas previstas dos eventos do período',
            color: 'text-blue-700',
          },
          {
            label: 'Recebido',
            value: brl(finance.recebido),
            hint: 'Já recebido desses eventos, inclusive antes do período',
            color: 'text-green-700',
          },
          {
            label: 'A receber',
            value: brl(finance.aReceber),
            hint: 'Saldo pendente desses mesmos eventos',
            color: 'text-orange-600',
          },
          {
            label: 'Custos',
            value: brl(finance.custos),
            hint: 'Equipe/cachês, som, operacionais, outros e personalizados',
            color: 'text-red-600',
          },
          {
            label: 'Lucro previsto',
            value: brl(finance.lucroPrevisto),
            hint: finance.margemPrevista === null
              ? 'Receita prevista − custos'
              : `Receita prevista − custos · margem ${pct(finance.margemPrevista)}`,
            color: profitColor,
          },
          {
            label: 'Percentual recebido',
            value: finance.percentualRecebido === null ? '—' : pct(finance.percentualRecebido),
            hint: finance.percentualRecebido === null ? 'Sem receita prevista no período' : 'Recebido ÷ receita prevista',
            color: 'text-gray-900',
          },
        ]}
      />
      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <Info size={13} className="mt-0.5 shrink-0" />
        {finance.eventos} evento(s) com data no período — mesma fonte e mesmo cálculo da aba Finanças.
        {finance.cancelados.count > 0 && (
          <>
            {' '}Inclui {finance.cancelados.count} evento(s) cancelado(s) ({brl(finance.cancelados.faturamentoPrevisto)}{' '}
            de receita prevista), como na aba Finanças.
          </>
        )}
      </p>
    </div>
  )
}
