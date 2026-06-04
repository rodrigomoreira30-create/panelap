'use client'

import { useState } from 'react'
import { Plus, Pencil, Check, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Attraction = {
  id: string
  name: string
  category: string | null
  description: string | null
  default_value: number
  is_active: boolean
}

interface AttractionSettingsProps {
  initialAttractions: Attraction[]
}

type EditForm = {
  name: string
  category: string
  description: string
  default_value: string
}

export function AttractionSettings({ initialAttractions }: AttractionSettingsProps) {
  const [attractions, setAttractions] = useState<Attraction[]>(initialAttractions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', category: '', description: '', default_value: '' })
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<EditForm>({ name: '', category: '', description: '', default_value: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit(a: Attraction) {
    setEditingId(a.id)
    setEditForm({
      name: a.name,
      category: a.category ?? '',
      description: a.description ?? '',
      default_value: String(a.default_value),
    })
  }

  async function handleSave(id: string) {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/attractions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        category: editForm.category || null,
        description: editForm.description || null,
        default_value: parseFloat(editForm.default_value) || 0,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const { data } = await res.json()
      setAttractions(prev => prev.map(a => a.id === id ? { ...a, ...data, default_value: parseFloat(data.default_value.toString()) } : a))
      setEditingId(null)
    } else {
      setError('Erro ao salvar.')
    }
  }

  async function handleToggleActive(a: Attraction) {
    const res = await fetch(`/api/attractions/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !a.is_active }),
    })
    if (res.ok) {
      setAttractions(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta atração do catálogo? Leads existentes não serão afetados.')) return
    const res = await fetch(`/api/attractions/${id}`, { method: 'DELETE' })
    if (res.ok) setAttractions(prev => prev.filter(a => a.id !== id))
  }

  async function handleCreate() {
    if (!newForm.name.trim()) { setError('Nome obrigatório.'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/attractions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newForm.name,
        category: newForm.category || undefined,
        description: newForm.description || undefined,
        default_value: parseFloat(newForm.default_value) || 0,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const { data } = await res.json()
      setAttractions(prev => [...prev, { ...data, default_value: parseFloat(data.default_value.toString()) }])
      setNewForm({ name: '', category: '', description: '', default_value: '' })
      setShowNew(false)
    } else {
      setError('Erro ao criar atração.')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Atrações cadastradas ficam disponíveis para seleção nos leads.
      </p>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="space-y-2">
        {attractions.map(a => (
          <div
            key={a.id}
            className={`flex items-center gap-2 p-3 border rounded-lg bg-white transition-opacity ${!a.is_active ? 'opacity-60' : ''}`}
          >
            {editingId === a.id ? (
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="h-8 text-sm col-span-2"
                  placeholder="Nome"
                />
                <Input
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Categoria"
                />
                <Input
                  type="number"
                  value={editForm.default_value}
                  onChange={e => setEditForm(f => ({ ...f, default_value: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Valor padrão"
                />
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-xs text-gray-400">
                  {a.category ?? '—'} · R$ {a.default_value.toLocaleString('pt-BR')}
                </div>
              </div>
            )}

            {editingId === a.id ? (
              <div className="flex gap-1 shrink-0">
                <Button size="sm" onClick={() => handleSave(a.id)} disabled={saving}>
                  <Check size={13} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                  <X size={13} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggleActive(a)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    a.is_active
                      ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'
                      : 'text-gray-400 border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {a.is_active ? 'ativo' : 'inativo'}
                </button>
                <button onClick={() => startEdit(a)} className="text-gray-400 hover:text-indigo-600 transition-colors p-1">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showNew ? (
        <div className="border border-dashed border-indigo-300 rounded-lg p-3 space-y-2 bg-indigo-50/30">
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newForm.name}
              onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              className="h-8 text-sm col-span-2"
              placeholder="Nome da atração *"
            />
            <Input
              value={newForm.category}
              onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
              className="h-8 text-sm"
              placeholder="Categoria"
            />
            <Input
              type="number"
              value={newForm.default_value}
              onChange={e => setNewForm(f => ({ ...f, default_value: e.target.value }))}
              className="h-8 text-sm"
              placeholder="Valor padrão (R$)"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving} className="flex-1">
              {saving ? 'Salvando...' : 'Criar atração'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setError('') }}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowNew(true)} className="w-full">
          <Plus size={14} className="mr-1" /> Nova atração
        </Button>
      )}
    </div>
  )
}
