'use client'

import { calcTotals, fmt, type EventFinanceData } from '@/lib/financas'

export function SummaryCards({ finances }: { finances: EventFinanceData[] }) {
  const { totalRevenue, totalReceived, totalToReceive, totalCosts, totalProfit, margin } =
    calcTotals(finances)

  const cards = [
    { label: 'Receita prevista', value: `R$ ${fmt(totalRevenue)}`,   color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-100'  },
    { label: 'Recebido',         value: `R$ ${fmt(totalReceived)}`,  color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' },
    { label: 'A receber',        value: `R$ ${fmt(totalToReceive)}`, color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-100'  },
    { label: 'Custos',           value: `R$ ${fmt(totalCosts)}`,     color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-100'   },
    {
      label: 'Lucro / Margem',
      value: `R$ ${fmt(totalProfit)} (${margin.toFixed(1)}%)`,
      color: totalProfit >= 0 ? 'text-green-700' : 'text-red-600',
      bg:    totalProfit >= 0 ? 'bg-green-50'    : 'bg-red-50',
      border: totalProfit >= 0 ? 'border-green-100' : 'border-red-100',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(card => (
        <div key={card.label} className={`rounded-lg border p-4 ${card.bg} ${card.border}`}>
          <p className="text-xs text-gray-500 mb-1">{card.label}</p>
          <p className={`text-sm font-bold leading-snug ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
