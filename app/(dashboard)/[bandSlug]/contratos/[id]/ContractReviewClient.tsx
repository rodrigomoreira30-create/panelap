'use client'

import { useRouter } from 'next/navigation'
import { ContractReview } from '@/components/contratos/ContractReview'

// ContractReview requires event.lead; use intersection type
type ContractWithLead = Parameters<typeof ContractReview>[0]['contract']

type Props = {
  contract: ContractWithLead
}

export function ContractReviewClient({ contract }: Props) {
  const router = useRouter()

  async function handleApprove() {
    const res = await fetch(`/api/contracts/${contract.id}/approve`, {
      method: 'POST',
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Erro ao aprovar contrato')
    }
    router.refresh()
  }

  return <ContractReview contract={contract} onApprove={handleApprove} />
}
