'use client'

import { useRef, useState } from 'react'
import { Paperclip, Trash2, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Doc = {
  id: string
  file_name: string
  file_url: string
  created_at: string
}

interface LeadDocumentsProps {
  leadId: string
  initialDocs: Doc[]
}

export function LeadDocuments({ leadId, initialDocs }: LeadDocumentsProps) {
  const [docs, setDocs] = useState<Doc[]>(initialDocs)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/leads/${leadId}/documents`, {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const { data } = await res.json()
      setDocs(prev => [data, ...prev])
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erro ao fazer upload')
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDelete(docId: string) {
    if (!confirm('Remover este arquivo?')) return
    const res = await fetch(`/api/leads/${leadId}/documents?docId=${docId}`, { method: 'DELETE' })
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== docId))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Documentos</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs h-7"
        >
          {uploading ? (
            <Loader2 size={13} className="mr-1 animate-spin" />
          ) : (
            <Paperclip size={13} className="mr-1" />
          )}
          {uploading ? 'Enviando...' : 'Anexar arquivo'}
        </Button>
        <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum documento anexado.</p>
      ) : (
        <ul className="space-y-1">
          {docs.map(doc => (
            <li key={doc.id} className="flex items-center gap-2 p-2 rounded border bg-gray-50 text-xs">
              <Paperclip size={12} className="text-gray-400 shrink-0" />
              <span className="flex-1 truncate text-gray-700">{doc.file_name}</span>
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 transition-colors p-0.5"
              >
                <Download size={13} />
              </a>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
