export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, MapPin, Music, Download } from 'lucide-react'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Aguardando confirmação', className: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmado',              className: 'bg-green-100 text-green-700' },
  declined:  { label: 'Recusou',                 className: 'bg-red-100 text-red-700' },
}

export default async function MusicianSchedulePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const musician = await prisma.user.findUnique({
    where: { schedule_token: token },
    select: {
      name: true,
      event_musicians: {
        where: { event: { event_date: { gte: new Date() } } },
        select: {
          id: true,
          status: true,
          event: {
            select: {
              client_name: true,
              event_type: true,
              event_date: true,
              event_time: true,
              venue_name: true,
              venue_address: true,
            },
          },
        },
        orderBy: { event: { event_date: 'asc' } },
      },
    },
  })

  if (!musician) notFound()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <Music size={28} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{musician.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Sua agenda de shows</p>
        </div>

        <a
          href={`/api/ics/${token}`}
          download="minha-agenda.ics"
          className="flex items-center justify-center gap-2 w-full mb-6 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Exportar para Google Calendar
        </a>

        {musician.event_musicians.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <Calendar size={40} className="mx-auto mb-3 opacity-50" />
            <p>Nenhum show agendado por enquanto.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {musician.event_musicians.map(em => {
              const cfg = statusConfig[em.status] ?? statusConfig.pending
              const eventDate = format(
                new Date(em.event.event_date),
                "EEEE, d 'de' MMMM yyyy",
                { locale: ptBR }
              )
              return (
                <div key={em.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{em.event.client_name}</p>
                      <p className="text-sm text-gray-500">
                        {eventTypeLabels[em.event.event_type] ?? em.event.event_type}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      {eventDate}{em.event.event_time ? ` às ${em.event.event_time}` : ''}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-gray-400 shrink-0" />
                      {em.event.venue_name ?? ''}{em.event.venue_address ? ` — ${em.event.venue_address}` : ''}
                    </p>
                  </div>
                  {em.status === 'pending' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <a
                        href={`/api/musicians/${em.id}/confirm?action=confirm`}
                        className="flex-1 text-center py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        ✓ Confirmar presença
                      </a>
                      <a
                        href={`/api/musicians/${em.id}/confirm?action=decline`}
                        className="flex-1 text-center py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium border border-red-200"
                      >
                        ✗ Recusar
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
