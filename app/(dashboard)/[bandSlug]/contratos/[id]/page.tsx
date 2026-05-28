import { prisma } from '@/lib/prisma'
import { ContractReviewClient } from './ContractReviewClient'
import { notFound } from 'next/navigation'

export default async function ContratoDetailPage({
  params,
}: {
  params: Promise<{ bandSlug: string; id: string }>
}) {
  const { bandSlug, id } = await params

  const band = await prisma.band.findUnique({
    where: { slug: bandSlug },
    select: { id: true },
  })

  if (!band) return notFound()

  const contract = await prisma.contract.findFirst({
    where: { id, event: { band_id: band.id } },
    include: {
      event: {
        include: { lead: true },
      },
      template: true,
      reviewer: true,
    },
  })

  if (!contract) return notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ContractReviewClient contract={contract} />
    </div>
  )
}
