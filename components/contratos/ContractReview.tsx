'use client'

import { useState } from 'react'
import { ContractFull } from '@/types'
import { Lead } from '@/lib/generated/prisma/client'
import { ContractStatusBadge } from './ContractStatusBadge'
import { fillTemplate, buildContractData } from '@/lib/contracts/template-fill'

// ContractFull has event: Event (no lead relation). Callers that want
// template fill to work should pass the event with its lead included.
type ContractWithLead = ContractFull & {
  event: ContractFull['event'] & { lead?: Lead | null }
}

type Props = {
  contract: ContractWithLead
  onApprove: () => Promise<void>
  onMarkSigned: () => Promise<void>
}

export function ContractReview({ contract, onApprove, onMarkSigned }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filledContent = contract.event.lead
    ? fillTemplate(contract.template.content, buildContractData(contract.event.lead))
    : contract.template.content

  async function run(action: () => Promise<void>, errorMessage: string) {
    setLoading(true)
    setError(null)
    try {
      await action()
    } catch {
      setError(errorMessage)
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

      {(contract.status === 'draft' || contract.status === 'pending_review') && (
        <div className="flex justify-end">
          <button
            onClick={() => run(onApprove, 'Erro ao marcar contrato como enviado. Tente novamente.')}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Marcar como enviado'}
          </button>
        </div>
      )}

      {contract.status === 'sent' && (
        <div className="flex justify-end">
          <button
            onClick={() => run(onMarkSigned, 'Erro ao marcar contrato como assinado. Tente novamente.')}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Marcar como assinado'}
          </button>
        </div>
      )}

      {contract.status === 'signed' && contract.signed_at && (
        <p className="text-sm text-gray-500 text-right">
          Assinado em {new Date(contract.signed_at).toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  )
}
