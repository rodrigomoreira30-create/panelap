'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard } from './LeadCard'
import { Badge } from '@/components/ui/badge'
import type { Lead, User } from '@/types'

const statusColors: Record<string, string> = {
  new_lead:      'bg-gray-100',
  attending:     'bg-blue-50',
  proposal_sent: 'bg-yellow-50',
  negotiation:   'bg-orange-50',
  closed:        'bg-green-50',
  lost:          'bg-red-50',
}

const statusLabels: Record<string, string> = {
  new_lead:      'Novo Lead',
  attending:     'Em Atendimento',
  proposal_sent: 'Proposta Enviada',
  negotiation:   'Negociação',
  closed:        'Fechado',
  lost:          'Perdido',
}

type LeadWithAssignee = Lead & {
  assignee: Pick<User, 'id' | 'name' | 'avatar_url'> | null
}

interface KanbanColumnProps {
  status: string
  leads: LeadWithAssignee[]
  onLeadClick: (lead: LeadWithAssignee) => void
}

export function KanbanColumn({ status, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <div className={`flex flex-col rounded-lg p-3 min-h-[400px] w-56 shrink-0 ${statusColors[status] ?? 'bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{statusLabels[status]}</span>
        <Badge variant="outline" className="text-xs">{leads.length}</Badge>
      </div>
      <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2 flex-1">
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
