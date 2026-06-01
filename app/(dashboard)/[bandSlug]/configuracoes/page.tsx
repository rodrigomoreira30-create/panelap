import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { SubscriptionStatus } from '@/components/configuracoes/SubscriptionStatus'
import { MemberList } from '@/components/configuracoes/MemberList'
import { PipelineSettings } from '@/components/configuracoes/PipelineSettings'
import { SourceSettings } from '@/components/configuracoes/SourceSettings'

export default async function ConfiguracoesPage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: user.id },
    include: { band: true },
  })

  if (!dbUser) redirect('/login')
  if (dbUser.role !== 'admin') redirect(`/${bandSlug}`)

  // Validate band membership
  if (!dbUser.band || dbUser.band.slug !== bandSlug) return notFound()

  const [members, band] = await Promise.all([
    prisma.user.findMany({
      where: { band_id: dbUser.band_id },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.band.findUnique({
      where: { id: dbUser.band_id },
      select: { pipeline_stages: true, lead_sources: true },
    }),
  ])

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-gray-500 text-sm">{dbUser.band.name}</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Assinatura</h2>
        <SubscriptionStatus hasAsaasId={!!dbUser.band.asaas_id} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Membros da Banda</h2>
        <MemberList members={members} currentUserId={dbUser.id} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Etapas do Pipeline</h2>
        <PipelineSettings initialStages={band?.pipeline_stages as { key: string; label: string }[] | null} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Fontes de Lead</h2>
        <SourceSettings initialSources={band?.lead_sources as { key: string; label: string }[] | null} />
      </section>
    </div>
  )
}
