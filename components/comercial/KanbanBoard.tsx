'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'

const DEFAULT_STAGES = [
  { key: 'new_lead',       label: 'Novo Lead' },
  { key: 'attending',      label: 'Em Atendimento' },
  { key: 'proposal_sent',  label: 'Proposta Enviada' },
  { key: 'negotiation',    label: 'Negociação' },
  { key: 'closed',         label: 'Fechado' },
  { key: 'lost',           label: 'Perdido' },
]

type Stage = { key: string; label: string }

export type KanbanLead = {
  id: string
  band_id: string
  client_name: string
  phone: string
  event_type: string
  event_date: string | null
  city: string | null
  venue_name: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  budget: number | null
  status: string
  assigned_to: string | null
  observations: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; name: string; avatar_url: string | null } | null
}

interface KanbanBoardProps {
  bandSlug: string
  pipelineStages: Stage[] | null
}

async function fetchLeads(): Promise<KanbanLead[]> {
  const res = await fetch('/api/leads')
  if (!res.ok) throw new Error('Falha ao carregar leads')
  const json = await res.json()
  return json.data.map((l: any) => ({
    ...l,
    budget: l.budget ? parseFloat(l.budget) : null,
  }))
}

export function KanbanBoard({ bandSlug, pipelineStages }: KanbanBoardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)

  const stages = pipelineStages ?? DEFAULT_STAGES
  const stageKeys = stages.map(s => s.key)
  const queryKey = ['leads', bandSlug]

  const { data: leads = [], isError, refetch } = useQuery({
    queryKey,
    queryFn: fetchLeads,
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const moveMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar status')
    },
    onMutate: async ({ leadId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KanbanLead[]>(queryKey)
      queryClient.setQueryData<KanbanLead[]>(queryKey, old =>
        (old ?? []).map(l => l.id === leadId ? { ...l, status: newStatus } : l)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
      toast({ title: 'Erro ao mover lead', description: 'Tente novamente.', variant: 'destructive' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao apagar lead')
    },
    onMutate: async (leadId) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KanbanLead[]>(queryKey)
      queryClient.setQueryData<KanbanLead[]>(queryKey, old =>
        (old ?? []).filter(l => l.id !== leadId)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
      toast({ title: 'Erro ao apagar lead', description: 'Tente novamente.', variant: 'destructive' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const getLeadsByStatus = (status: string) => leads.filter(l => l.status === status)
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const leadId = active.id as string
    const newStatus = over.id as string
    if (!stageKeys.includes(newStatus)) return
    moveMutation.mutate({ leadId, newStatus })
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <p>Não foi possível carregar os leads.</p>
        <button onClick={() => refetch()} className="text-sm underline hover:text-gray-700">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => (
          <KanbanColumn
            key={stage.key}
            status={stage.key}
            label={stage.label}
            leads={getLeadsByStatus(stage.key)}
            onLeadClick={lead => router.push(`/${bandSlug}/comercial/${lead.id}`)}
            onLeadDelete={id => deleteMutation.mutate(id)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} onClick={() => {}} />}
      </DragOverlay>
    </DndContext>
  )
}
