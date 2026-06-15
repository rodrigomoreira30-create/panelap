'use client'

import { useState, useRef } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface EventAlignmentNotesProps {
  eventId: string
  initialNotes: string | null
}

export function EventAlignmentNotes({ eventId, initialNotes }: EventAlignmentNotesProps) {
  const [value, setValue] = useState(initialNotes ?? '')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(initialNotes ?? '')

  async function save(text: string) {
    if (text === lastSavedRef.current) return
    setSaving(true)
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: text || null }),
    })
    lastSavedRef.current = text
    setSaving(false)
    setSaved(true)
    if (savedRef.current) clearTimeout(savedRef.current)
    savedRef.current = setTimeout(() => setSaved(false), 2000)
  }

  function handleBlur() {
    save(value)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Alinhamentos do Evento</h3>
        <span className="text-xs text-gray-400 flex items-center gap-1 h-4">
          {saving && <><Loader2 size={11} className="animate-spin" /> Salvando...</>}
          {!saving && saved && <><Check size={11} className="text-green-500" /> Salvo</>}
        </span>
      </div>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Escreva aqui os alinhamentos do evento: horários, setlist combinado, orientações do cliente, observações técnicas, contatos no local..."
        rows={8}
        className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 leading-relaxed"
      />
    </div>
  )
}
