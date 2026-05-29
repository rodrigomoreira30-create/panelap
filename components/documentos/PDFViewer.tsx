'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Download } from 'lucide-react'

interface PDFViewerProps {
  documentId: string
  fileName: string
}

export function PDFViewer({ documentId, fileName }: PDFViewerProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadUrl() {
    setLoading(true)
    const res = await fetch(`/api/documents/${documentId}/download`)
    if (res.ok) {
      const { data } = await res.json()
      setUrl(data.url)
    }
    setLoading(false)
  }

  if (!url) {
    return (
      <Button variant="ghost" size="sm" onClick={loadUrl} disabled={loading}>
        <ExternalLink size={14} className="mr-1" />
        {loading ? 'Carregando...' : 'Visualizar'}
      </Button>
    )
  }

  const isPdf = fileName.toLowerCase().endsWith('.pdf')

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <a href={url} download={fileName}>
          <Button variant="outline" size="sm">
            <Download size={14} className="mr-1" /> Download
          </Button>
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink size={14} className="mr-1" /> Abrir
          </Button>
        </a>
      </div>
      {isPdf && (
        <iframe
          src={url}
          className="w-full h-[600px] border rounded"
          title={fileName}
        />
      )}
    </div>
  )
}
