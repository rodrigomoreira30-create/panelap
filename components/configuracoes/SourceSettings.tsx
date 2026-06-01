'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GripVertical, Trash2, Plus } from 'lucide-react'

type Source = { key: string; label: string }

const DEFAULT_SOURCES: Source[] = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]

interface SourceSettingsProps {
  initialSources: Source[] | null
}

export function SourceSettings({ initialSources }: SourceSettingsProps) {
  const router = useRouter()
  const [sources, setSources] = useState<Source[]>(initialSources ?? DEFAULT_SOURCES)
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  function updateLabel(index: number, label: string) {
    setSources(prev => prev.map((s, i) => i === index ? { ...s, label } : s))
  }

  function removeSource(index: number) {
    if (sources.length <= 1) return
    setSources(prev => prev.filter((_, i) => i !== index))
  }

  function addSource() {
    const key = `source_${Date.now()}`
    setSources(prev => [...prev, { key, label: 'Nova Fonte' }])
  }

  function onDragStart(index: number) {
    setDragIndex(index)
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const updated = [...sources]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, moved)
    setSources(updated)
    setDragIndex(index)
  }

  function onDragEnd() {
    setDragIndex(null)
  }

  async function handleSave() {
    const emptyLabel = sources.find(s => !s.label.trim())
    if (emptyLabel) { setError('Todas as fontes precisam de um nome.'); return }
    setError('')
    setSaving(true)
    const res = await fetch('/api/settings/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    })
    setSaving(false)
    if (res.ok) router.refresh()
    else setError('Erro ao salvar. Tente novamente.')
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Arraste para reordenar. Edite os nomes ou adicione novas fontes.
      </p>

      <div className="space-y-2">
        {sources.map((source, index) => (
          <div
            key={source.key}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={e => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-2 p-2 border rounded-lg bg-white transition-opacity ${dragIndex === index ? 'opacity-50' : ''}`}
          >
            <GripVertical size={16} className="text-gray-300 cursor-grab shrink-0" />
            <Input
              value={source.label}
              onChange={e => updateLabel(index, e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <button
              onClick={() => removeSource(index)}
              disabled={sources.length <= 1}
              className="text-gray-300 hover:text-red-500 disabled:opacity-20 transition-colors p-1"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addSource} className="w-full">
        <Plus size={14} className="mr-1" /> Adicionar fonte
      </Button>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Salvando...' : 'Salvar fontes'}
      </Button>
    </div>
  )
}
