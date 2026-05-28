import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MessageThread } from '@/components/comercial/MessageThread'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const statusLabels: Record<string, string> = {
  new_lead: 'Novo Lead', attending: 'Em Atendimento',
  proposal_sent: 'Proposta Enviada', negotiation: 'Negociação',
  closed: 'Fechado', lost: 'Perdido',
}

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

  const lead = await prisma.lead.findUnique({
    where: { id: leadId, band_id: dbUser.band_id },
    include: {
      messages: { orderBy: { sent_at: 'asc' } },
      assignee: { select: { id: true, name: true } },
    },
  })

  if (!lead) notFound()

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0 space-y-4">
        <div>
          <h2 className="text-xl font-bold">{lead.client_name}</h2>
          <p className="text-gray-500">{lead.phone}</p>
          <Badge className="mt-1">{statusLabels[lead.status]}</Badge>
        </div>
        <div className="space-y-2 text-sm">
          {lead.event_date && (
            <div>
              <span className="font-medium">Data do evento:</span>{' '}
              {format(new Date(lead.event_date as Date), "dd 'de' MMMM yyyy", { locale: ptBR })}
            </div>
          )}
          {lead.city && (
            <div><span className="font-medium">Cidade:</span> {lead.city}</div>
          )}
          {lead.venue_name && (
            <div><span className="font-medium">Local:</span> {lead.venue_name}</div>
          )}
          {lead.budget != null && (
            <div>
              <span className="font-medium">Orçamento:</span>{' '}
              R$ {parseFloat(lead.budget.toString()).toLocaleString('pt-BR')}
            </div>
          )}
          <div>
            <span className="font-medium">Som:</span>{' '}
            {lead.venue_has_sound ? 'Incluso' : 'Não incluso'}
          </div>
          <div>
            <span className="font-medium">Luz:</span>{' '}
            {lead.venue_has_light ? 'Incluso' : 'Não incluso'}
          </div>
          {lead.assignee && (
            <div><span className="font-medium">Responsável:</span> {lead.assignee.name}</div>
          )}
          {lead.observations && (
            <div>
              <span className="font-medium">Observações:</span>
              <p className="text-gray-600 mt-1">{lead.observations}</p>
            </div>
          )}
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
