'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

interface MonthSelectorProps {
  month: number
  year: number
  onChange: (month: number, year: number) => void
}

export function MonthSelector({ month, year, onChange }: MonthSelectorProps) {
  function prev() {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }
  function next() {
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-1 rounded hover:bg-gray-100 transition-colors">
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-semibold w-36 text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <button onClick={next} className="p-1 rounded hover:bg-gray-100 transition-colors">
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
