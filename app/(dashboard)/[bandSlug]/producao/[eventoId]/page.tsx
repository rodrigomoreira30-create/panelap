import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { EventDetailClient } from '@/components/producao/EventDetailClient'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

const statusLabels: Record<string, string> = {
  contracted: 'Contratado', active: 'Em andamento', done: 'Concluído',
}

const statusColors: Record<string, string> = {
  contracted: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  done: 'bg-gray-100 text-gray-600',
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ bandSlug: string; eventoId: string }>
}) {
  const { eventoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const [event, bandMembers] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventoId, band_id: dbUser.band_id },
      include: {
        checklists: { include: { items: { orderBy: { id: 'asc' } } } },
        event_musicians: {
          include: { user: { select: { id: true, name: true, avatar_url: true, schedule_token: true } } },
          orderBy: { id: 'asc' },
        },
      },
    }),
    prisma.user.findMany({
      where: { band_id: dbUser.band_id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!event) return notFound()

  const queryClient = new QueryClient()
  queryClient.setQueryData(['event', eventoId], {
    checklists: event.checklists.map(c => ({
      id: c.id,
      title: c.title,
      items: c.items.map(i => ({
        id: i.id,
        description: i.description,
        done: i.done,
      })),
    })),
    event_musicians: event.event_musicians.map(m => ({
      id: m.id,
      user_id: m.user_id,
      instrument: m.instrument,
      status: m.status,
      user: m.user,
    })),
  })

  const valueFormatted = parseFloat(event.value.toString()).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-8 max-w-4xl">
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

        <EventDetailClient eventoId={eventoId} bandMembers={bandMembers} />
      </div>
    </HydrationBoundary>
  )
}
