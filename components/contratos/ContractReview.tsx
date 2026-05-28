'use client'

import { useState } from 'react'
import { ContractFull } from '@/types'
import { Lead } from '@/lib/generated/prisma/client'
import { ContractStatusBadge } from './ContractStatusBadge'
import { fillTemplate, buildContractData, LeadForContract } from '@/lib/contracts/template-fill'

// ContractFull has event: Event (no lead relation). Callers that want
// template fill to work should pass the event with its lead included.
type ContractWithLead = ContractFull & {
  event: ContractFull['event'] & { lead?: Lead | null }
}

type Props = {
  contract: ContractWithLead
  onApprove: () => Promise<void>
}

export function ContractReview({ contract, onApprove }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filledContent = contract.event.lead
    ? fillTemplate(contract.template.content, buildContractData(contract.event.lead as LeadForContract))
    : contract.template.content

  async function handleApprove() {
    setLoading(true)
    setError(null)
    try {
      await onApprove()
    } catch {
      setError('Erro ao aprovar contrato. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Contrato — {contract.event.client_name}
        </h2>
        <ContractStatusBadge status={contract.status} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{filledContent}</pre>
      </div>

      {contract.status === 'draft' && (
        <div className="flex justify-end">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar para Assinatura'}
          </button>
        </div>
      )}

      {contract.zapsign_link && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
          Link de assinatura:{' '}
          <a href={contract.zapsign_link} target="_blank" rel="noopener noreferrer" className="underline">
            {contract.zapsign_link}
          </a>
        </div>
      )}
    </div>
  )
}
