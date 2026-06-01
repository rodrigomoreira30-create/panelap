import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MessageThread } from '@/components/comercial/MessageThread'
import { LeadEditPanel } from '@/components/comercial/LeadEditPanel'
import { LeadDocuments } from '@/components/comercial/LeadDocuments'

const DEFAULT_STAGES = [
  { key: 'new_lead',      label: 'Novo Lead' },
  { key: 'attending',     label: 'Em Atendimento' },
  { key: 'proposal_sent', label: 'Proposta Enviada' },
  { key: 'negotiation',   label: 'Negociação' },
  { key: 'closed',        label: 'Fechado' },
  { key: 'lost',          label: 'Perdido' },
]

const DEFAULT_SOURCES = [
  { key: 'referral',     label: 'Indicação' },
  { key: 'social_media', label: 'Redes Sociais' },
  { key: 'paid_traffic', label: 'Tráfego Pago' },
]

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ bandSlug: string; leadId: string }>
}) {
  const { leadId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const [lead, band] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId, band_id: dbUser.band_id },
      include: {
        messages: { orderBy: { sent_at: 'asc' } },
        assignee: { select: { id: true, name: true } },
        documents: { orderBy: { created_at: 'desc' } },
      },
    }),
    prisma.band.findUnique({
      where: { id: dbUser.band_id },
      select: { pipeline_stages: true, lead_sources: true },
    }),
  ])

  if (!lead) notFound()

  const stages = (band?.pipeline_stages as { key: string; label: string }[] | null) ?? DEFAULT_STAGES
  const sources = (band?.lead_sources as { key: string; label: string }[] | null) ?? DEFAULT_SOURCES

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0 space-y-4 overflow-y-auto pr-1">
        <LeadEditPanel
          lead={{
            id:              lead.id,
            client_name:     lead.client_name,
            phone:           lead.phone,
            event_type:      lead.event_type,
            event_date:      lead.event_date ? lead.event_date.toISOString() : null,
            city:            lead.city,
            venue_name:      lead.venue_name,
            budget:          lead.budget ? parseFloat(lead.budget.toString()) : null,
            venue_has_sound: lead.venue_has_sound,
            venue_has_light: lead.venue_has_light,
            observations:    lead.observations,
            status:          lead.status,
            source:          lead.source,
            tags:            (lead.tags as string[]) ?? [],
            assignee:        lead.assignee,
          }}
          stages={stages}
          sources={sources}
        />

        <div className="border-t pt-4">
          <LeadDocuments
            leadId={lead.id}
            initialDocs={lead.documents.map(d => ({
              id: d.id,
              file_name: d.file_name,
              file_url: d.file_url,
              created_at: d.created_at.toISOString(),
            }))}
          />
        </div>
      </div>
      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b bg-gray-50">
          <h3 className="font-medium text-sm">Histórico de Mensagens</h3>
        </div>
        <MessageThread leadId={lead.id} messages={lead.messages as any} />
      </div>
    </div>
  )
}
