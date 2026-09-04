'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Link2, Check, Loader2, Plus, UserPlus } from 'lucide-react'
import type { EventData, EventMusician } from './EventDetailClient'
import { InstrumentPicker } from './InstrumentPicker'
import { AssignMusicianModal } from './AssignMusicianModal'

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-700' },
  declined:  { label: 'Recusou',    className: 'bg-red-100 text-red-700' },
}

type BandMember = { id: string; name: string }

type Props = {
  eventId: string
  musicians: EventMusician[]
  bandMembers: BandMember[]
  initialTeamNotes?: string | null
}

export function TeamPanel({ eventId, musicians, bandMembers, initialTeamNotes }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ['event', eventId]

  const [showPicker, setShowPicker] = useState(false)
  const [assigning, setAssigning] = useState<EventMusician | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [teamNotes, setTeamNotes] = useState(initialTeamNotes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  async function saveTeamNotes(text: string) {
    if (text === (initialTeamNotes ?? '')) return
    setNotesSaving(true)
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_notes: text || null }),
    })
    setNotesSaving(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  function handleCopyLink(token: string, musicianId: string) {
    const url = `${window.location.origin}/musico/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(musicianId)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {})
  }

  // Adicionar posição (sem músico)
  const addPositionMutation = useMutation({
    mutationFn: async (instrument: string) => {
      const res = await fetch('/api/event-musicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, instrument }),
      })
      if (!res.ok) throw new Error('Falha ao adicionar posição')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // Atribuir músico + cachê a uma vaga
  const assignMutation = useMutation({
    mutationFn: async ({ id, userId, cacheValue }: { id: string; userId: string; cacheValue: number | null }) => {
      const res = await fetch('/api/event-musicians', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user_id: userId, cache_value: cacheValue }),
      })
      if (!res.ok) throw new Error('Falha ao atribuir músico')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setAssigning(null)
    },
  })

  // Remover posição
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/event-musicians?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao remover')
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData<EventData>(queryKey, old =>
        old ? { ...old, event_musicians: old.event_musicians.filter(m => m.id !== id) } : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  function handleInstrumentSelect(instrument: string) {
    setShowPicker(false)
    addPositionMutation.mutate(instrument)
  }

  function handleAssignConfirm(userId: string, cacheValue: number | null) {
    if (!assigning) return
    assignMutation.mutate({ id: assigning.id, userId, cacheValue })
  }

  const assignedUserIds = musicians.filter(m => m.user_id !== null).map(m => m.user_id as string)

  return (
    <div className="space-y-4">
      {/* Lista de vagas */}
      <div className="space-y-2">
        {musicians.length === 0 && (
          <p className="text-gray-400 text-sm">Nenhuma posição adicionada ainda.</p>
        )}
        {musicians.map(em => {
          const cfg = em.user ? (statusConfig[em.status] ?? statusConfig.pending) : null
          return (
            <div key={em.id} className="flex items-center gap-3 p-4 border rounded-xl bg-white shadow-sm">
              {/* Ícone */}
              <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-xl shrink-0">
                🎵
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide truncate">
                  {em.instrument ?? 'Sem instrumento'}
                </p>
                {em.user ? (
                  <>
                    <p className="text-sm font-medium text-gray-900 truncate">{em.user.name}</p>
                    {em.cache_value != null && (
                      <p className="text-xs text-gray-400">
                        R$ {Number(em.cache_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-medium text-orange-500">Vaga aberta</p>
                )}
              </div>

              {/* Status badge */}
              {cfg && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.className}`}>
                  {cfg.label}
                </span>
              )}

              {/* Atribuir músico */}
              <button
                onClick={() => setAssigning(em)}
                className="text-gray-400 hover:text-indigo-500 transition-colors p-1 shrink-0"
                title="Atribuir músico"
              >
                <UserPlus size={16} />
              </button>

              {/* Copiar link (só se tiver músico) */}
              {em.user && em.user.schedule_token && (
                <button
                  onClick={() => handleCopyLink(em.user!.schedule_token, em.id)}
                  className="text-gray-400 hover:text-blue-500 transition-colors p-0.5 shrink-0"
                  title="Copiar link da agenda"
                >
                  {copiedId === em.id
                    ? <Check size={14} className="text-green-500" />
                    : <Link2 size={14} />}
                </button>
              )}

              {/* Remover */}
              <button
                onClick={() => { if (window.confirm('Remover esta posição?')) removeMutation.mutate(em.id) }}
                disabled={removeMutation.isPending}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
                title="Remover posição"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Botão adicionar */}
      <button
        onClick={() => setShowPicker(true)}
        disabled={addPositionMutation.isPending}
        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 transition-colors"
      >
        {addPositionMutation.isPending
          ? <Loader2 size={15} className="animate-spin" />
          : <Plus size={15} />}
        Adicionar instrumento
      </button>

      {/* Observações da equipe */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-medium text-gray-700">Observações Equipe Escalada</p>
          <span className="text-xs text-gray-400 flex items-center gap-1 h-4">
            {notesSaving && <><Loader2 size={11} className="animate-spin" /> Salvando...</>}
            {!notesSaving && notesSaved && <><Check size={11} className="text-green-500" /> Salvo</>}
          </span>
        </div>
        <textarea
          value={teamNotes}
          onChange={e => setTeamNotes(e.target.value)}
          onBlur={e => saveTeamNotes(e.target.value)}
          placeholder="Orientações internas para a equipe..."
          rows={3}
          className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 leading-relaxed"
        />
      </div>

      {/* Modal: Selecionar instrumento */}
      {showPicker && (
        <InstrumentPicker
          onSelect={handleInstrumentSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Modal: Atribuir músico */}
      {assigning && (
        <AssignMusicianModal
          instrument={assigning.instrument ?? 'Sem instrumento'}
          currentUserId={assigning.user_id}
          bandMembers={bandMembers}
          assignedUserIds={assignedUserIds}
          onConfirm={handleAssignConfirm}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  )
}
