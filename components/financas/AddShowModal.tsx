'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { EventFinanceData } from '@/lib/financas'

interface AvailableEvent { id: string; client_name: string; event_date: string }

interface AddShowModalProps {
  availableEvents: AvailableEvent[]
  onAdded: (finance: EventFinanceData) => void
  onClose: () => void
}

export function AddShowModal({ availableEvents, onAdded, onClose }: AddShowModalProps) {
  const [selectedEventId, setSelectedEventId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/financas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: selectedEventId }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : 'Erro ao vincular financeiro ao evento')
      return
    }

    const { data } = await res.json()
    onAdded(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Vincular evento ao financeiro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <Label>Evento da produção</Label>
            {availableEvents.length === 0 ? (
              <p className="text-sm text-gray-400 mt-2">Nenhum evento disponível neste mês sem registro financeiro.</p>
            ) : (
              <select
                required
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecionar evento...</option>
                {availableEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.client_name} — {new Date(ev.event_date).toLocaleDateString('pt-BR')}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !selectedEventId}>
              {loading ? 'Vinculando...' : 'Vincular'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
