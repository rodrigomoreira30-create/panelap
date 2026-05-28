import { prisma } from '@/lib/prisma'
import { ContractListClient } from './ContractListClient'

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

  if (!band) return <div>Banda não encontrada.</div>

  const contracts = await prisma.contract.findMany({
    where: { event: { band_id: band.id } },
    include: { event: true, template: true, reviewer: true },
    orderBy: { created_at: 'desc' },
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Contratos</h1>
      <ContractListClient contracts={contracts} bandSlug={bandSlug} />
    </div>
  )
}
