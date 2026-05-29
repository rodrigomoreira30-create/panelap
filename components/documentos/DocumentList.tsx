'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PDFViewer } from './PDFViewer'
import { Trash2, FileText } from 'lucide-react'

const typeLabels: Record<string, string> = {
  contract: 'Contrato', rider: 'Rider', briefing: 'Briefing',
  map: 'Mapa', other: 'Outro',
}

type DocumentItem = {
  id: string
  file_name: string
  file_url: string
  type: string
  created_at: Date | string
  uploader: { id: string; name: string }
  event: { id: string; client_name: string } | null
}

interface DocumentListProps {
  documents: DocumentItem[]
  canDelete?: boolean
}

export function DocumentList({ documents, canDelete }: DocumentListProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FileText size={32} className="mx-auto mb-2 opacity-40" />
        <p>Nenhum documento ainda.</p>
      </div>
    )
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este documento?')) return
    setDeleting(id)
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
    setDeleting(null)
  }

  return (
    <div className="divide-y">
      {documents.map(doc => (
        <div key={doc.id} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              <div>
                <button
                  className="text-sm font-medium hover:underline text-left"
                  onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                >
                  {doc.file_name}
                </button>
                <p className="text-xs text-gray-400">
                  {doc.event ? `${doc.event.client_name} · ` : ''}
                  {doc.uploader.name} ·{' '}
                  {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {typeLabels[doc.type] ?? doc.type}
              </Badge>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:text-red-600"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deleting === doc.id}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
          {expandedId === doc.id && (
            <div className="pl-6">
              <PDFViewer documentId={doc.id} fileName={doc.file_name} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
