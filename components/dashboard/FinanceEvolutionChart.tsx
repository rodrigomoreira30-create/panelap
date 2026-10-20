// components/dashboard/FinanceEvolutionChart.tsx
'use client'

import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AnalysisCriterion, Granularity } from '@/lib/dashboard-period'
import type { FinanceEvolutionItem } from './DashboardClient'
import { brl } from './FinanceCards'

const COLORS = { faturamento: '#3b82f6', custos: '#f97316', lucro: '#059669', recebido: '#059669' }

const GRANULARITY_LABEL: Record<Granularity, string> = { day: 'por dia', week: 'por semana', month: 'por mês' }

function compact(value: number) {
  return value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
}

type Props = {
  data: FinanceEvolutionItem[]
  granularity: Granularity
  criterion: AnalysisCriterion
}

export function FinanceEvolutionChart({ data, granularity, criterion }: Props) {
  const byReceipt = criterion === 'recebimento'
  const hasData = data.some(d =>
    'recebido' in d ? d.recebido !== 0 : d.faturamento !== 0 || d.custos !== 0,
  )

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="text-sm font-medium text-gray-700">
          Evolução Financeira
          <span className="ml-2 text-xs font-normal text-gray-400">{GRANULARITY_LABEL[granularity]}</span>
        </h3>
        <span className="text-xs text-gray-400">
          {byReceipt ? 'Recebimentos pela data do pagamento' : 'Por data do evento · valores do Financeiro Geral'}
        </span>
      </div>
      {!hasData ? (
        <p className="text-gray-400 text-sm">
          {byReceipt ? 'Nenhum recebimento registrado no período.' : 'Nenhum evento com financeiro no período.'}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={compact}
              width={48}
            />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Tooltip
              cursor={{ fill: '#f9fafb' }}
              formatter={(value, name) => [brl(Number(value ?? 0)), name]}
              labelStyle={{ color: '#374151', fontWeight: 500 }}
            />
            {byReceipt ? (
              <Bar dataKey="recebido" name="Recebido" fill={COLORS.recebido} radius={[4, 4, 0, 0]} maxBarSize={32} />
            ) : (
              <>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#6b7280' }} />
                <Bar dataKey="faturamento" name="Faturamento previsto" fill={COLORS.faturamento} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="custos" name="Custos" fill={COLORS.custos} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line
                  dataKey="lucro"
                  name="Lucro previsto"
                  type="monotone"
                  stroke={COLORS.lucro}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 5 }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
