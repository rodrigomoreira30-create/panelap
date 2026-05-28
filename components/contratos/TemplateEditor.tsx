'use client'

import { useState } from 'react'

type Props = {
  initialName?: string
  initialContent?: string
  isDefault?: boolean
  onSave: (data: { name: string; content: string; is_default: boolean }) => Promise<void>
  onCancel: () => void
}

export function TemplateEditor({ initialName = '', initialContent = '', isDefault = false, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialName)
  const [content, setContent] = useState(initialContent)
  const [defaultTemplate, setDefaultTemplate] = useState(isDefault)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) {
      setError('Nome deve ter ao menos 2 caracteres')
      return
    }
    if (content.trim().length < 10) {
      setError('Conteúdo deve ter ao menos 10 caracteres')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), content: content.trim(), is_default: defaultTemplate })
    } catch {
      setError('Erro ao salvar template. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Template</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Contrato Padrão de Casamento"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
        <p className="text-xs text-gray-500 mb-2">{'Use {{variavel}} para inserir dados do lead. Ex: {{cliente_nome}}, {{data_evento}}'}</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Contrato entre {{cliente_nome}}..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_default"
          checked={defaultTemplate}
          onChange={(e) => setDefaultTemplate(e.target.checked)}
          className="h-4 w-4 text-blue-600"
        />
        <label htmlFor="is_default" className="text-sm text-gray-700">Template padrão para novos contratos</label>
      </div>

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Salvando...' : 'Salvar Template'}
        </button>
      </div>
    </form>
  )
}
