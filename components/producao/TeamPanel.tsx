'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Link2, Check, Loader2 } from 'lucide-react'
import type { EventData, EventMusician } from './EventDetailClient'

const POSITIONS = [
  'Cantor 1',
  'Cantor 2',
  'Cantor 3',
  'Cantor 4',
  'Guitarrista',
  'Baixista',
  'Baterista',
  'Tecladista',
  'Saxofonista',
  'Sanfoneiro',
  'Trompetista',
  'Trombonista',
  'Tecnico',
  'Equipe de Som',
  'DJ',
  'Time SB',
  'Time AllMusic',
  'Time Beats',
]

const POSITION_ICONS: Record<string, string> = {
  'Cantor 1':    '🎤',
  'Cantor 2':    '🎤',
  'Cantor 3':    '🎤',
  'Cantor 4':    '🎤',
  'Guitarrista': '🎸',
  'Baixista':    '🎸',
  'Baterista':   '🥁',
  'Tecladista':  '🎹',
  'Saxofonista': '🎷',
  'Sanfoneiro':  '🪗',
  'Trompetista': '🎺',
  'Trombonista': '🎺',
  'Tecnico':       '🎛️',
  'Equipe de Som': '🔊',
  'DJ':            '🎧',
  'Time SB':       '🎵',
  'Time AllMusic': '🎵',
  'Time Beats':    '🎵',
}

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
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [teamNotes, setTeamNotes] = useState(initialTeamNotes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const lastSavedNotes = useRef(initialTeamNotes ?? '')
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function saveTeamNotes(text: string) {
    if (text === lastSavedNotes.current) return
    setNotesSaving(true)
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_notes: text || null }),
    })
    lastSavedNotes.current = text
    setNotesSaving(false)
    setNotesSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setNotesSaved(false), 2000)
  }

  function handleCopyLink(token: string, musicianId: string) {
    const url = `${window.location.origin}/musico/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(musicianId)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {})
  }

  const alreadyAdded = new Set(musicians.map(m => m.user_id))
  const usedPositions = new Set(musicians.map(m => m.instrument).filter(Boolean))
  const available = bandMembers.filter(m => !alreadyAdded.has(m.id))
  const availablePositions = POSITIONS.filter(p => !usedPositions.has(p))

  const addMutation = useMutation({
    mutationFn: async ({ userId, position }: { userId: string; position: string }) => {
      const res = await fetch('/api/event-musicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, user_id: userId, instrument: position || undefined }),
      })
      if (!res.ok) throw new Error('Falha ao adicionar músico')
    },
    onMutate: async ({ userId, position }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      const member = bandMembers.find(m => m.id === userId)
      const tempMusician: EventMusician = {
        id: `temp-${Date.now()}`,
        user_id: userId,
        instrument: position || null,
        status: 'pending',
        user: { id: userId, name: member?.name ?? '', avatar_url: null, schedule_token: '' },
      }
      queryClient.setQueryData<EventData>(queryKey, old =>
        old ? { ...old, event_musicians: [...old.event_musicians, tempMusician] } : old
      )
      setSelectedUserId('')
      setSelectedPosition('')
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/event-musicians?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao remover músico')
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData<EventData>(queryKey, (old) => {
        if (!old) return old
        return { ...old, event_musicians: old.event_musicians.filter((m) => m.id !== id) }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {musicians.length === 0 && (
          <p className="text-gray-400 text-sm">Nenhum músico escalado ainda.</p>
        )}
        {musicians.map(em => {
          const cfg = statusConfig[em.status] ?? statusConfig.pending
          return (
            <div key={em.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                {em.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{em.user.name}</p>
                {em.instrument && (
                  <p className="text-xs text-gray-400">
                    {POSITION_ICONS[em.instrument] && <span className="mr-1">{POSITION_ICONS[em.instrument]}</span>}
                    {em.instrument}
                  </p>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                {cfg.label}
              </span>
              <button
                onClick={() => handleCopyLink(em.user.schedule_token, em.id)}
                className="text-gray-400 hover:text-blue-500 transition-colors p-0.5"
                aria-label="Copiar link da agenda"
                title="Copiar link da agenda"
              >
                {copiedId === em.id
                  ? <Check size={14} className="text-green-500" />
                  : <Link2 size={14} />}
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Remover músico do evento?')) removeMutation.mutate(em.id)
                }}
                disabled={removeMutation.isPending}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                aria-label="Remover músico"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>

      {available.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Selecionar membro...</option>
              {available.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              value={selectedPosition}
              onChange={e => setSelectedPosition(e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Selecionar posição...</option>
              {availablePositions.map(p => (
                <option key={p} value={p}>{POSITION_ICONS[p]} {p}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { if (selectedUserId) addMutation.mutate({ userId: selectedUserId, position: selectedPosition }) }}
            disabled={!selectedUserId || addMutation.isPending}
            className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {addMutation.isPending ? 'Adicionando...' : 'Adicionar à equipe'}
          </button>
        </div>
      )}

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
          placeholder="Orientações internas para a equipe: horários de montagem, contatos, logística..."
          rows={3}
          className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-2.5 resize-y overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 leading-relaxed"
        />
      </div>
    </div>
  )
}
