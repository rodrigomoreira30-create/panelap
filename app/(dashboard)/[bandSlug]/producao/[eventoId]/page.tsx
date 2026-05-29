import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ChecklistPanel } from '@/components/producao/ChecklistPanel'
import { TeamPanel } from '@/components/producao/TeamPanel'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const eventTypeLabels: Record<string, string> = {
  wedding:   'Casamento',
  party:     'Festa',
  show:      'Show',
  corporate: 'Corporativo',
  other:     'Outro',
}

const statusLabels: Record<string, string> = {
  contracted: 'Contratado',
  active:     'Em andamento',
  done:       'Concluído',
}

const statusColors: Record<string, string> = {
  contracted: 'bg-blue-100 text-blue-700',
  active:     'bg-green-100 text-green-700',
  done:       'bg-gray-100 text-gray-600',
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ bandSlug: string; eventoId: string }>
}) {
  const { bandSlug, eventoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const event = await prisma.event.findFirst({
    where: { id: eventoId, band_id: dbUser.band_id },
    include: {
      checklists: { include: { items: { orderBy: { id: 'asc' } } } },
      event_musicians: {
        include: { user: { select: { id: true, name: true, avatar_url: true } } },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!event) return notFound()

  const bandMembers = await prisma.user.findMany({
    where: { band_id: dbUser.band_id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const valueFormatted = parseFloat(event.value.toString()).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // bandSlug is used to keep the page scoped to the band context
  void bandSlug

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.client_name}</h1>
          <p className="text-gray-500">
            {format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
            {event.event_time && ` às ${event.event_time}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[event.status] ?? ''}`}>
            {statusLabels[event.status] ?? event.status}
          </span>
          <span className="text-xs text-gray-500">
            {eventTypeLabels[event.event_type] ?? event.event_type}
          </span>
        </div>
      </div>

      {/* Event info grid */}
      <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded-lg p-4">
        <div><span className="font-medium text-gray-700">Local:</span> <span>{event.venue_name}</span></div>
        {event.venue_address && (
          <div><span className="font-medium text-gray-700">Endereço:</span> <span>{event.venue_address}</span></div>
        )}
        <div>
          <span className="font-medium text-gray-700">Som:</span>{' '}
          <span>{event.venue_has_sound ? '✅ Incluso' : '❌ Providenciar'}</span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Luz:</span>{' '}
          <span>{event.venue_has_light ? '✅ Incluso' : '❌ Providenciar'}</span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Valor:</span>{' '}
          <span>R$ {valueFormatted}</span>
        </div>
        {event.technical_visit_date && (
          <div>
            <span className="font-medium text-gray-700">Visita técnica:</span>{' '}
            <span>{format(new Date(event.technical_visit_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
          </div>
        )}
      </div>

      {event.notes && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">Observações</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.notes}</p>
        </div>
      )}

      {/* Checklists */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Checklists Operacionais</h2>
        <ChecklistPanel checklists={event.checklists} />
      </div>

      {/* Team */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Equipe Escalada</h2>
        <TeamPanel
          eventId={event.id}
          musicians={event.event_musicians as any}
          bandMembers={bandMembers}
        />
      </div>
    </div>
  )
}
