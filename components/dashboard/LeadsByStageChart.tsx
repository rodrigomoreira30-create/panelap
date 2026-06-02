// components/dashboard/LeadsByStageChart.tsx
'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { LeadsByStageItem } from './DashboardClient'

type Props = { data: LeadsByStageItem[] }

export function LeadsByStageChart({ data }: Props) {
  const hasData = data.some(d => d.count > 0)

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Leads por etapa</h3>
      {!hasData ? (
        <p className="text-gray-400 text-sm">Nenhum lead cadastrado ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              cursor={{ fill: '#f9fafb' }}
              formatter={(value) => [value ?? 0, 'Leads']}
            />
            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
