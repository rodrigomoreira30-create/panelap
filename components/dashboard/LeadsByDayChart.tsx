// components/dashboard/LeadsByDayChart.tsx
'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { Granularity } from '@/lib/dashboard-period'
import type { LeadsByDayItem } from './DashboardClient'

type Props = { data: LeadsByDayItem[]; granularity: Granularity }

// Leads agrupados pela data de criação, no mesmo agrupamento da Evolução Financeira.
const TITLE: Record<Granularity, string> = { day: 'Leads por dia', week: 'Leads por semana', month: 'Leads por mês' }
const TOOLTIP_PREFIX: Record<Granularity, string> = { day: 'Dia', week: 'Semana de', month: 'Mês' }

export function LeadsByDayChart({ data, granularity }: Props) {
  const hasData = data.some(d => d.count > 0)
  const chartData = data

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">{TITLE[granularity]}</h3>
      {!hasData ? (
        <p className="text-gray-400 text-sm">Nenhum lead cadastrado no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: '#f9fafb' }}
              formatter={(value) => [value ?? 0, 'Leads']}
              labelFormatter={(label) => `${TOOLTIP_PREFIX[granularity]}: ${label}`}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
