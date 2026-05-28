'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import type { Lead, User } from '@/types'

const PIPELINE_STAGES = ['new_lead', 'attending', 'proposal_sent', 'negotiation', 'closed', 'lost']

type LeadWithAssignee = Lead & {
  assignee: Pick<User, 'id' | 'name' | 'avatar_url'> | null
}

interface KanbanBoardProps {
  initialLeads: LeadWithAssignee[]
  bandSlug: string
}

export function KanbanBoard({ initialLeads, bandSlug }: KanbanBoardProps) {
  const router = useRouter()
  const [leads, setLeads] = useState<LeadWithAssignee[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const getLeadsByStatus = (status: string) =>
    leads.filter(l => l.status === status)

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const leadId = active.id as string
    const newStatus = over.id as string

    if (!PIPELINE_STAGES.includes(newStatus)) return

    setLeads(prev =>
      prev.map(l => l.id === leadId ? { ...l, status: newStatus as Lead['status'] } : l)
    )

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar status')
    } catch {
      setLeads(initialLeads)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => (
          <KanbanColumn
            key={stage}
            status={stage}
            leads={getLeadsByStatus(stage)}
            onLeadClick={lead => router.push(`/${bandSlug}/comercial/${lead.id}`)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && (
          <LeadCard lead={activeLead} onClick={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
