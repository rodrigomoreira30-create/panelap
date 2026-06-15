'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GripVertical, Trash2, Plus } from 'lucide-react'

type Stage = { key: string; label: string }

const DEFAULT_STAGES: Stage[] = [
  { key: 'new_lead',       label: 'Novo Lead' },
  { key: 'attending',      label: 'Em Atendimento' },
  { key: 'proposal_sent',  label: 'Proposta Enviada' },
  { key: 'negotiation',    label: 'Negociação' },
  { key: 'closed',         label: 'Fechado' },
  { key: 'lost',           label: 'Perdido' },
]

interface PipelineSettingsProps {
  initialStages: Stage[] | null
}

export function PipelineSettings({ initialStages }: PipelineSettingsProps) {
  const router = useRouter()
  const [stages, setStages] = useState<Stage[]>(initialStages ?? DEFAULT_STAGES)
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  function updateLabel(index: number, label: string) {
    setStages(prev => prev.map((s, i) => i === index ? { ...s, label } : s))
  }

  function removeStage(index: number) {
    if (stages.length <= 1) return
    setStages(prev => prev.filter((_, i) => i !== index))
  }

  function addStage() {
    const key = `stage_${Date.now()}`
    setStages(prev => [...prev, { key, label: 'Nova Etapa' }])
  }

  function onDragStart(index: number) {
    setDragIndex(index)
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const updated = [...stages]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, moved)
    setStages(updated)
    setDragIndex(index)
  }

  function onDragEnd() {
    setDragIndex(null)
  }

  async function handleSave() {
    const emptyLabel = stages.find(s => !s.label.trim())
    if (emptyLabel) { setError('Todas as etapas precisam de um nome.'); return }
    setError('')
    setSaving(true)
    const res = await fetch('/api/settings/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stages }),
    })
    setSaving(false)
    if (res.ok) router.refresh()
    else setError('Erro ao salvar. Tente novamente.')
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Arraste para reordenar. Edite os nomes ou adicione novas etapas.
      </p>

      <div className="space-y-2">
        {stages.map((stage, index) => (
          <div
            key={stage.key}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={e => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-2 p-2 border rounded-lg bg-white transition-opacity ${dragIndex === index ? 'opacity-50' : ''}`}
          >
            <GripVertical size={16} className="text-gray-300 cursor-grab shrink-0" />
            <Input
              value={stage.label}
              onChange={e => updateLabel(index, e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <button
              onClick={() => removeStage(index)}
              disabled={stages.length <= 1}
              className="text-gray-300 hover:text-red-500 disabled:opacity-20 transition-colors p-1"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addStage} className="w-full">
        <Plus size={14} className="mr-1" /> Adicionar etapa
      </Button>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Salvando...' : 'Salvar etapas'}
      </Button>
    </div>
  )
}
