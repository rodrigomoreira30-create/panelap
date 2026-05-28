'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface LeadFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function LeadForm({ onSuccess, onCancel }: LeadFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    client_name: '', phone: '', event_type: '',
    city: '', venue_name: '', budget: '',
    venue_has_sound: false, venue_has_light: false,
    observations: '',
  })

  function set(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget: form.budget ? parseFloat(form.budget) : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(typeof data.error === 'string' ? data.error : 'Erro ao criar lead')
        setLoading(false)
        return
      }

      onSuccess()
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nome do cliente *</Label>
          <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} required />
        </div>
        <div>
          <Label>Telefone / WhatsApp *</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} required />
        </div>
        <div>
          <Label>Tipo de evento *</Label>
          <Select onValueChange={v => set('event_type', v)} required>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wedding">Casamento</SelectItem>
              <SelectItem value="party">Festa</SelectItem>
              <SelectItem value="show">Show</SelectItem>
              <SelectItem value="corporate">Corporativo</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Orçamento estimado (R$)</Label>
          <Input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <Label>Local do evento</Label>
          <Input value={form.venue_name} onChange={e => set('venue_name', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.venue_has_sound}
            onChange={e => set('venue_has_sound', e.target.checked)}
          />
          Local tem som
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.venue_has_light}
            onChange={e => set('venue_has_light', e.target.checked)}
          />
          Local tem luz
        </label>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea value={form.observations} onChange={e => set('observations', e.target.value)} />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Criar Lead'}</Button>
      </div>
    </form>
  )
}
