import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/comercial/KanbanBoard'
import { NewLeadButton } from '@/components/comercial/NewLeadButton'

const DEFAULT_SOURCES = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]

export default async function ComercialPage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['leads', bandSlug],
    queryFn: async () => {
      const leads = await prisma.lead.findMany({
        where: { band_id: dbUser.band_id },
        include: { assignee: { select: { id: true, name: true, avatar_url: true } } },
        orderBy: { created_at: 'desc' },
      })
      return leads.map(l => ({
        ...l,
        budget:            l.budget ? parseFloat(l.budget.toString()) : null,
        proposal_discount: l.proposal_discount ? parseFloat(l.proposal_discount.toString()) : null,
        event_date:        l.event_date ? l.event_date.toISOString() : null,
        created_at:        l.created_at.toISOString(),
        updated_at:        l.updated_at.toISOString(),
        tags:              Array.isArray(l.tags) ? l.tags : [],
      }))
    },
  })

  const band = await prisma.band.findUnique({
    where: { id: dbUser.band_id },
    select: { pipeline_stages: true, lead_sources: true },
  })

  const pipelineStages = (band?.pipeline_stages as { key: string; label: string }[] | null) ?? null
  const leadSources = (band?.lead_sources as { key: string; label: string }[] | null) ?? DEFAULT_SOURCES

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Comercial</h1>
            <p className="text-gray-500 text-sm">Pipeline de leads e oportunidades</p>
          </div>
          <NewLeadButton sources={leadSources} />
        </div>
        <KanbanBoard
          bandSlug={bandSlug}
          pipelineStages={pipelineStages}
          leadSources={leadSources}
        />
      </div>
    </HydrationBoundary>
  )
}
