'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LeadStatusSelectProps {
  leadId: string
  currentStatus: string
  stages: { key: string; label: string }[]
}

export function LeadStatusSelect({ leadId, currentStatus, stages }: LeadStatusSelectProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return
    setSaving(true)
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
    setSaving(false)
  }

  return (
    <Select value={currentStatus} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stages.map(s => (
          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
