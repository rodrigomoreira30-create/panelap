'use client'

import { useRouter } from 'next/navigation'
import { ContractList } from '@/components/contratos/ContractList'
import { ContractFull } from '@/types'

type Props = {
  contracts: ContractFull[]
  bandSlug: string
}

export function ContractListClient({ contracts, bandSlug }: Props) {
  const router = useRouter()

  async function handleApprove(id: string) {
    const res = await fetch(`/api/contracts/${id}/approve`, { method: 'POST' })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error ?? 'Erro ao aprovar contrato')
      return
    }
    router.refresh()
  }

  function handleView(id: string) {
    router.push(`/${bandSlug}/contratos/${id}`)
  }

  return (
    <ContractList
      contracts={contracts}
      onApprove={handleApprove}
      onView={handleView}
    />
  )
}
