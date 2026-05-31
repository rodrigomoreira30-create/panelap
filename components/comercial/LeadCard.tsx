'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { KanbanLead } from './KanbanBoard'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

interface LeadCardProps {
  lead: KanbanLead
  onClick: () => void
  onDelete?: (id: string) => void
}

export function LeadCard({ lead, onClick, onDelete }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <p className="font-medium text-sm leading-tight">{lead.client_name}</p>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="secondary" className="text-xs">
                {eventTypeLabels[lead.event_type] ?? lead.event_type}
              </Badge>
              {onDelete && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm(`Apagar lead de ${lead.client_name}?`)) onDelete(lead.id)
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
          {lead.event_date && (
            <p className="text-xs text-gray-500">
              {format(new Date(lead.event_date), "dd 'de' MMM yyyy", { locale: ptBR })}
            </p>
          )}
          {lead.city && (
            <p className="text-xs text-gray-400">{lead.city}</p>
          )}
          {lead.budget != null && (
            <p className="text-xs font-medium text-green-600">
              R$ {lead.budget.toLocaleString('pt-BR')}
            </p>
          )}
          {lead.assignee && (
            <div className="flex items-center gap-1 mt-1">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">
                  {lead.assignee.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-500">{lead.assignee.name}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
