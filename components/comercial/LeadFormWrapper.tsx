'use client'

import { useRouter } from 'next/navigation'
import { LeadForm } from './LeadForm'

export function LeadFormWrapper() {
  const router = useRouter()
  return (
    <LeadForm
      onSuccess={() => router.refresh()}
      onCancel={() => {}}
    />
  )
}
