'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import { Search, X, SlidersHorizontal, Check } from 'lucide-react'

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
  source: string | null
  tags: string[]
  assigned_to: string | null
  observations: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; name: string; avatar_url: string | null } | null
}

type Source = { key: string; label: string }

const DEFAULT_SOURCES: Source[] = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]

interface KanbanBoardProps {
  bandSlug: string
  pipelineStages: Stage[] | null
  leadSources: Source[] | null
}

async function fetchLeads(): Promise<KanbanLead[]> {
  const res = await fetch('/api/leads')
  if (!res.ok) throw new Error('Falha ao carregar leads')
  const json = await res.json()
  return json.data.map((l: any) => ({
    ...l,
    budget: l.budget ? parseFloat(l.budget) : null,
    tags: Array.isArray(l.tags) ? l.tags : [],
  }))
}

export function KanbanBoard({ bandSlug, pipelineStages, leadSources }: KanbanBoardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const stages = pipelineStages ?? DEFAULT_STAGES
  const sources = leadSources ?? DEFAULT_SOURCES
  const stageKeys = stages.map(s => s.key)
  const queryKey = ['leads', bandSlug]

  const [visibleStageKeys, setVisibleStageKeys] = useState<string[]>(stageKeys)
  const [stageFilterOpen, setStageFilterOpen] = useState(false)
  const stageFilterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stageFilterRef.current && !stageFilterRef.current.contains(e.target as Node)) {
        setStageFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleStage(key: string) {
    setVisibleStageKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const visibleStages = stages.filter(s => visibleStageKeys.includes(s.key))

  const { data: leads = [], isError, refetch } = useQuery({
    queryKey,
    queryFn: fetchLeads,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const allTags = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => l.tags.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [leads])

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter(l => {
      if (q) {
        const matchName  = l.client_name.toLowerCase().includes(q)
        const matchPhone = l.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
        if (!matchName && !matchPhone) return false
      }
      if (selectedTags.length > 0 && !selectedTags.every(t => l.tags.includes(t))) return false
      return true
    })
  }, [leads, search, selectedTags])

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

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
    onSuccess: (_data, { newStatus }) => {
      if (newStatus === 'closed') {
        queryClient.invalidateQueries({ queryKey })
      }
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

  const getLeadsByStatus = (status: string) => filteredLeads.filter(l => l.status === status)
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const leadId = active.id as string
    const overId = over.id as string

    // over.id pode ser o ID de uma coluna (droppable) ou de outro card (sortable)
    let newStatus: string
    if (stageKeys.includes(overId)) {
      newStatus = overId
    } else {
      const targetLead = leads.find(l => l.id === overId)
      if (!targetLead) return
      newStatus = targetLead.status
    }

    const currentLead = leads.find(l => l.id === leadId)
    if (!currentLead || currentLead.status === newStatus) return

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

  const hasFilters = search.trim() !== '' || selectedTags.length > 0
  const totalFiltered = filteredLeads.length
  const totalAll = leads.length

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de busca e filtros */}
      <div className="flex flex-col gap-2">
        {/* Busca + filtro de etapas */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro de etapas */}
          <div className="relative" ref={stageFilterRef}>
            <button
              onClick={() => setStageFilterOpen(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors whitespace-nowrap ${
                visibleStageKeys.length < stages.length
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              <SlidersHorizontal size={14} />
              Etapas
              {visibleStageKeys.length < stages.length && (
                <span className="bg-white text-blue-600 rounded-full text-xs px-1.5 font-bold leading-none py-0.5">
                  {visibleStageKeys.length}
                </span>
              )}
            </button>

            {stageFilterOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[200px]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">
                  Etapas visíveis
                </p>
                {stages.map(stage => {
                  const active = visibleStageKeys.includes(stage.key)
                  return (
                    <button
                      key={stage.key}
                      onClick={() => toggleStage(stage.key)}
                      className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        active ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {active && <Check size={11} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className={active ? 'text-gray-900' : 'text-gray-400'}>{stage.label}</span>
                    </button>
                  )
                })}
                {visibleStageKeys.length < stages.length && (
                  <button
                    onClick={() => setVisibleStageKeys(stageKeys)}
                    className="w-full mt-1 pt-2 border-t border-gray-100 text-xs text-blue-600 hover:text-blue-700 text-center py-1"
                  >
                    Mostrar todas
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 shrink-0">Tags:</span>
            {allTags.map(tag => {
              const active = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Limpar
              </button>
            )}
          </div>
        )}

        {/* Contador quando filtros ativos */}
        {hasFilters && (
          <p className="text-xs text-gray-400">
            {totalFiltered} de {totalAll} lead{totalAll !== 1 ? 's' : ''} exibido{totalFiltered !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setActiveId(active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {visibleStages.map(stage => (
            <KanbanColumn
              key={stage.key}
              status={stage.key}
              label={stage.label}
              leads={getLeadsByStatus(stage.key)}
              sources={sources}
              onLeadClick={lead => router.push(`/${bandSlug}/comercial/${lead.id}`)}
              onLeadDelete={id => deleteMutation.mutate(id)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} onClick={() => {}} sources={sources} />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
