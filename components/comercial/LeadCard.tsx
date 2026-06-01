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

type Source = { key: string; label: string }

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

interface LeadCardProps {
  lead: KanbanLead
  onClick: () => void
  onDelete?: (id: string) => void
  sources?: Source[]
}

export function LeadCard({ lead, onClick, onDelete, sources }: LeadCardProps) {
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
              {(() => {
                const [y, m, d] = lead.event_date!.slice(0, 10).split('-').map(Number)
                return format(new Date(y, m - 1, d), "dd 'de' MMM yyyy", { locale: ptBR })
              })()}
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
          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {lead.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 leading-none">
                  {tag}
                </span>
              ))}
              {lead.tags.length > 3 && (
                <span className="text-[10px] text-gray-400">+{lead.tags.length - 3}</span>
              )}
            </div>
          )}
          {lead.source && sources && (() => {
            const src = sources.find(s => s.key === lead.source)
            return src ? (
              <p className="text-xs text-gray-400">{src.label}</p>
            ) : null
          })()}
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
