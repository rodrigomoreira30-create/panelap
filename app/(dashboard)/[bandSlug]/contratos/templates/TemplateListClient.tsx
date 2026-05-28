'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateList } from '@/components/contratos/TemplateList'
import { TemplateEditor } from '@/components/contratos/TemplateEditor'

type Template = {
  id: string
  name: string
  is_default: boolean
  created_at: Date | string
  content: string
}

type Props = {
  templates: Template[]
}

export function TemplateListClient({ templates }: Props) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const editingTemplate = templates.find((t) => t.id === editingId)

  async function handleSave(data: { name: string; content: string; is_default: boolean }) {
    const url = editingId ? `/api/contract-templates/${editingId}` : '/api/contract-templates'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Erro ao salvar template')
    }

    setEditingId(null)
    setCreating(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/contract-templates/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error ?? 'Erro ao excluir template')
      return
    }
    router.refresh()
  }

  if (creating || editingId) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {creating ? 'Novo Template' : 'Editar Template'}
        </h1>
        <TemplateEditor
          initialName={editingTemplate?.name ?? ''}
          initialContent={editingTemplate?.content ?? ''}
          isDefault={editingTemplate?.is_default ?? false}
          onSave={handleSave}
          onCancel={() => {
            setEditingId(null)
            setCreating(false)
          }}
        />
      </div>
    )
  }

  return (
    <TemplateList
      templates={templates}
      onEdit={(id) => setEditingId(id)}
      onDelete={handleDelete}
      onCreate={() => setCreating(true)}
    />
  )
}
