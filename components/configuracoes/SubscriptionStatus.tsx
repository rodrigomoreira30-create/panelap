'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

const planLabels: Record<string, string> = {
  starter:    'Starter — R$ 97/mês',
  pro:        'Pro — R$ 197/mês',
  enterprise: 'Enterprise — R$ 397/mês',
}

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE:          { label: 'Ativa',          color: 'bg-green-100 text-green-800' },
  OVERDUE:         { label: 'Em atraso',       color: 'bg-red-100 text-red-800' },
  INACTIVE:        { label: 'Inativa',         color: 'bg-gray-100 text-gray-800' },
  no_subscription: { label: 'Sem assinatura',  color: 'bg-yellow-100 text-yellow-800' },
  error:           { label: 'Erro',            color: 'bg-gray-100 text-gray-800' },
}

interface SubData {
  status: string
  plan: string
  value?: number
  next_due?: string
  asaas_id?: string | null
}

interface SubscriptionStatusProps {
  hasAsaasId: boolean
}

export function SubscriptionStatus({ hasAsaasId }: SubscriptionStatusProps) {
  const [sub, setSub] = useState<SubData | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(r => r.json())
      .then(({ data }) => setSub(data))
      .catch(() => setSub({ status: 'error', plan: 'unknown' }))
  }, [])

  async function openPortal() {
    setLoadingPortal(true)
    const res = await fetch('/api/billing/portal')
    if (res.ok) {
      const { data } = await res.json()
      window.open(data.url, '_blank', 'noopener,noreferrer')
    }
    setLoadingPortal(false)
  }

  if (!sub) return <div className="h-20 bg-gray-100 animate-pulse rounded-lg" />

  const statusInfo = statusLabels[sub.status] ?? statusLabels.error

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{planLabels[sub.plan] ?? sub.plan}</p>
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        {hasAsaasId && (
          <Button variant="outline" size="sm" onClick={openPortal} disabled={loadingPortal}>
            <ExternalLink size={14} className="mr-1" />
            {loadingPortal ? 'Abrindo...' : 'Gerenciar assinatura'}
          </Button>
        )}
      </div>
      {sub.next_due && (
        <p className="text-sm text-gray-500">
          Próximo vencimento: {new Date(sub.next_due).toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  )
}
