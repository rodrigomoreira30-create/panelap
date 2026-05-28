import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TemplateListClient } from './TemplateListClient'

export default async function ContractTemplatesPage({
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

  const templates = await prisma.contractTemplate.findMany({
    where: { band_id: band.id },
    orderBy: { created_at: 'desc' },
  })

  return (
    <div className="p-6">
      <TemplateListClient templates={templates} />
    </div>
  )
}
