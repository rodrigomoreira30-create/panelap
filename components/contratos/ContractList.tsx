'use client'

import { ContractFull } from '@/types'
import { ContractStatusBadge } from './ContractStatusBadge'

type Props = {
  contracts: ContractFull[]
  onApprove: (id: string) => void
  onView: (id: string) => void
}

export function ContractList({ contracts, onApprove, onView }: Props) {
  if (contracts.length === 0) {
    return <p className="text-gray-500 text-sm">Nenhum contrato encontrado.</p>
  }

  return (
    <div className="space-y-3">
      {contracts.map((contract) => (
        <div key={contract.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex-1">
            <p className="font-medium text-gray-900">{contract.event.client_name}</p>
            <p className="text-sm text-gray-500">Template: {contract.template.name}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(contract.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ContractStatusBadge status={contract.status} />
            <button
              onClick={() => onView(contract.id)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver
            </button>
            {contract.status === 'draft' && (
              <button
                onClick={() => onApprove(contract.id)}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Aprovar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
