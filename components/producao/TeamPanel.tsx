'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Link2, Check } from 'lucide-react'
import type { EventData, EventMusician } from './EventDetailClient'

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
}

export function TeamPanel({ eventId, musicians, bandMembers }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ['event', eventId]
  const [selectedUserId, setSelectedUserId] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function handleCopyLink(token: string, musicianId: string) {
    const url = `${window.location.origin}/musico/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(musicianId)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {})
  }

  const alreadyAdded = new Set(musicians.map(m => m.user_id))
  const available = bandMembers.filter(m => !alreadyAdded.has(m.id))

  const addMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/event-musicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, user_id: userId }),
      })
      if (!res.ok) throw new Error('Falha ao adicionar músico')
    },
    onSuccess: () => {
      setSelectedUserId('')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => {
      console.error('Falha ao adicionar músico ao evento')
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
                {em.instrument && <p className="text-xs text-gray-400">{em.instrument}</p>}
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
          <button
            onClick={() => { if (selectedUserId) addMutation.mutate(selectedUserId) }}
            disabled={!selectedUserId || addMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {addMutation.isPending ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      )}
    </div>
  )
}
