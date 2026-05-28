'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

type MusicianStatus = 'pending' | 'confirmed' | 'declined'

const statusConfig: Record<MusicianStatus, { label: string; className: string }> = {
  pending:   { label: 'Pendente',    className: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmado',  className: 'bg-green-100 text-green-700' },
  declined:  { label: 'Recusou',     className: 'bg-red-100 text-red-700' },
}

type EventMusicianWithUser = {
  id: string
  user_id: string
  instrument: string | null
  status: MusicianStatus
  user: {
    id: string
    name: string
    avatar_url: string | null
  }
}

type BandMember = {
  id: string
  name: string
}

type Props = {
  eventId: string
  musicians: EventMusicianWithUser[]
  bandMembers: BandMember[]
}

export function TeamPanel({ eventId, musicians: initialMusicians, bandMembers }: Props) {
  const router = useRouter()
  const [musicians, setMusicians] = useState(initialMusicians)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [adding, setAdding] = useState(false)

  const alreadyAdded = new Set(musicians.map(m => m.user_id))
  const available = bandMembers.filter(m => !alreadyAdded.has(m.id))

  async function addMusician() {
    if (!selectedUserId) return
    setAdding(true)
    try {
      const res = await fetch('/api/event-musicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, user_id: selectedUserId }),
      })
      if (res.ok) {
        setSelectedUserId('')
        router.refresh()
      }
    } finally {
      setAdding(false)
    }
  }

  async function removeMusician(id: string) {
    if (!window.confirm('Remover músico do evento?')) return
    await fetch(`/api/event-musicians?id=${id}`, { method: 'DELETE' })
    setMusicians(prev => prev.filter(m => m.id !== id))
  }

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
                onClick={() => removeMusician(em.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
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
            onClick={addMusician}
            disabled={!selectedUserId || adding}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      )}
    </div>
  )
}
