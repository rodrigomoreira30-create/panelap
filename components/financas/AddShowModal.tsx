'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EventFinanceData } from '@/lib/financas'

interface AvailableEvent { id: string; client_name: string; event_date: string }

interface AddShowModalProps {
  availableEvents: AvailableEvent[]
  month: number
  year: number
  onAdded: (finance: EventFinanceData) => void
  onClose: () => void
}

const PRODUCTS = ['Sapo Brasilis', 'All Music', 'Studio 3', 'Lumiare', 'Cerimônia', 'DJ', 'Som/Luz', 'Outro']

export function AddShowModal({ availableEvents, month, year, onAdded, onClose }: AddShowModalProps) {
  const [tab, setTab] = useState<'existing' | 'manual'>(availableEvents.length > 0 ? 'existing' : 'manual')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [form, setForm] = useState({
    name: '',
    client: '',
    product: '',
    event_date: `${year}-${String(month).padStart(2, '0')}-01`,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const body = tab === 'existing'
      ? { event_id: selectedEventId }
      : { name: form.name, client: form.client || undefined, product: form.product || undefined, event_date: form.event_date }

    const res = await fetch('/api/financas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : 'Erro ao criar show financeiro')
      return
    }

    const { data } = await res.json()
    onAdded(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Adicionar show financeiro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(['existing', 'manual'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'existing' ? 'Vincular evento' : 'Entrada avulsa'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {tab === 'existing' ? (
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
          ) : (
            <>
              <div>
                <Label>Nome do show *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1"
                  placeholder="Ex: Casamento Rodrigo"
                />
              </div>
              <div>
                <Label>Cliente</Label>
                <Input
                  value={form.client}
                  onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                  className="mt-1"
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <Label>Produto contratado</Label>
                <select
                  value={form.product}
                  onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecionar produto...</option>
                  {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label>Data do show *</Label>
                <Input
                  required
                  type="date"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              disabled={loading || (tab === 'existing' && !selectedEventId)}
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
