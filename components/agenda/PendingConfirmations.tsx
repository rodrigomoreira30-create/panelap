'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'

type PendingItem = {
  event_id: string
  user_id: string
  user: { name: string }
  event: { client_name: string; event_type: string; event_date: Date | null }
}

export function PendingConfirmations({ items }: { items: PendingItem[] }) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="border border-yellow-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 hover:bg-yellow-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-yellow-800 font-semibold text-sm">
          <Clock size={15} className="text-yellow-600 shrink-0" />
          Confirmações Pendentes
          <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        {open
          ? <ChevronUp size={16} className="text-yellow-600 shrink-0" />
          : <ChevronDown size={16} className="text-yellow-600 shrink-0" />}
      </button>

      {open && (
        <ul className="max-h-52 overflow-y-auto divide-y divide-yellow-100 bg-yellow-50">
          {items.map(pm => (
            <li
              key={`${pm.event_id}-${pm.user_id}`}
              className="px-4 py-2.5 text-sm text-yellow-700"
            >
              <span className="font-medium text-yellow-900">{pm.user.name}</span>
              {' — '}
              {pm.event.client_name} ({pm.event.event_type})
              {pm.event.event_date
                ? ` · ${new Date(pm.event.event_date).toLocaleDateString('pt-BR')}`
                : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
