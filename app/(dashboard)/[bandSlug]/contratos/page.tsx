import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ContractListClient } from './ContractListClient'
import type { ContractFull } from '@/types'

export default async function ContratosPage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params

  const band = await prisma.band.findUnique({
    where: { slug: bandSlug },
    select: { id: true },
  })

  if (!band) return notFound()

  const contracts = await prisma.contract.findMany({
    where: { event: { band_id: band.id } },
    include: { event: true, template: true, reviewer: true },
    orderBy: { created_at: 'desc' },
  })

  // Prisma Decimal não é serializável pelo React RSC — converte event.value para número
  const serializedContracts = contracts.map(c => ({
    ...c,
    event: { ...c.event, value: Number(c.event.value) },
  }))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Contratos</h1>
      <ContractListClient contracts={serializedContracts as ContractFull[]} bandSlug={bandSlug} />
    </div>
  )
}
