import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { SubscriptionStatus } from '@/components/configuracoes/SubscriptionStatus'
import { MemberList } from '@/components/configuracoes/MemberList'
import { AddMember } from '@/components/configuracoes/AddMember'
import { PipelineSettings } from '@/components/configuracoes/PipelineSettings'
import { SourceSettings } from '@/components/configuracoes/SourceSettings'
import { AttractionSettings } from '@/components/configuracoes/AttractionSettings'
import { SettingsSection } from '@/components/configuracoes/SettingsSection'
import { DEFAULT_STAGES, DEFAULT_SOURCES } from '@/lib/settings-defaults'

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

  const [members, band, attractions] = await Promise.all([
    prisma.user.findMany({
      where: { band_id: dbUser.band_id },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.band.findUnique({
      where: { id: dbUser.band_id },
      select: { pipeline_stages: true, lead_sources: true },
    }),
    prisma.attraction.findMany({
      where: { band_id: dbUser.band_id },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    }),
  ])

  const stageCount =
    (band?.pipeline_stages as { key: string; label: string }[] | null)?.length ??
    DEFAULT_STAGES.length
  const sourceCount =
    (band?.lead_sources as { key: string; label: string }[] | null)?.length ??
    DEFAULT_SOURCES.length

  return (
    <div className="p-6 space-y-6 max-w-2xl md:max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-gray-500 text-sm">{dbUser.band.name}</p>
      </div>

      <div className="space-y-3">
        <SettingsSection title="Assinatura" description="Resumo do plano atual">
          <SubscriptionStatus hasAsaasId={!!dbUser.band.asaas_id} />
        </SettingsSection>

        <SettingsSection
          title="Membros da Banda"
          description={`${members.length} ${members.length === 1 ? 'membro' : 'membros'}`}
        >
          <div className="space-y-3">
            <AddMember />
            <MemberList members={members} currentUserId={dbUser.id} />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Etapas do Pipeline"
          description={`${stageCount} ${stageCount === 1 ? 'etapa' : 'etapas'}`}
        >
          <PipelineSettings
            initialStages={band?.pipeline_stages as { key: string; label: string }[] | null}
          />
        </SettingsSection>

        <SettingsSection
          title="Fontes de Lead"
          description={`${sourceCount} ${sourceCount === 1 ? 'fonte' : 'fontes'}`}
        >
          <SourceSettings
            initialSources={band?.lead_sources as { key: string; label: string }[] | null}
          />
        </SettingsSection>

        <SettingsSection
          title="Atrações Disponíveis"
          description={`${attractions.length} ${attractions.length === 1 ? 'atração cadastrada' : 'atrações cadastradas'}`}
        >
          <AttractionSettings
            initialAttractions={attractions.map(a => ({
              id: a.id,
              name: a.name,
              category: a.category,
              description: a.description,
              default_value: parseFloat(a.default_value.toString()),
              is_active: a.is_active,
            }))}
          />
        </SettingsSection>
      </div>
    </div>
  )
}
