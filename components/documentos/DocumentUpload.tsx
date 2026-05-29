'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload } from 'lucide-react'

const typeLabels = [
  { value: 'contract', label: 'Contrato' },
  { value: 'rider',    label: 'Rider Técnico' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'map',      label: 'Mapa / Planta' },
  { value: 'other',    label: 'Outro' },
]

interface DocumentUploadProps {
  eventId?: string
  onSuccess?: () => void
}

export function DocumentUpload({ eventId, onSuccess }: DocumentUploadProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setProgress(10)

    try {
      // Step 1: get signed upload URL
      const urlRes = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.name, mime_type: file.type, event_id: eventId }),
      })
      if (!urlRes.ok) throw new Error('Falha ao obter URL de upload')
      const { data: uploadData } = await urlRes.json()
      setProgress(30)

      // Step 2: upload directly to Supabase Storage
      const uploadRes = await fetch(uploadData.signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) throw new Error('Falha no upload do arquivo')
      setProgress(70)

      // Step 3: register in DB
      const registerRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.name, file_url: uploadData.file_url, type, event_id: eventId }),
      })
      if (!registerRes.ok) throw new Error('Falha ao registrar documento')
      setProgress(100)

      onSuccess?.()
      router.refresh()
      setTimeout(() => setProgress(0), 1000)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeLabels.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} className="mr-2" />
          {uploading ? `Enviando... ${progress}%` : 'Selecionar arquivo'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {progress > 0 && progress < 100 && (
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
