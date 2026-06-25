import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { EventDetailClient } from '@/components/producao/EventDetailClient'
import { EventAlignmentNotes } from '@/components/producao/EventAlignmentNotes'
import { EventInfoPanel } from '@/components/producao/EventInfoPanel'

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
        lead: { include: { lead_attractions: { orderBy: { created_at: 'asc' } } } },
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

  const attractions = event.lead?.lead_attractions ?? []

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-8 max-w-4xl">
        <EventInfoPanel
          event={{
            id:              event.id,
            client_name:     event.client_name,
            event_type:      event.event_type,
            event_date:      event.event_date.toISOString(),
            event_time:      event.event_time ?? null,
            venue_name:      event.venue_name,
            venue_address:   event.venue_address ?? null,
            venue_has_sound: event.venue_has_sound,
            venue_has_light: event.venue_has_light,
            value:           parseFloat(event.value.toString()),
            status:          event.status,
          }}
          attractions={attractions.map(a => ({ id: a.id, name: a.name }))}
        />

        <EventDetailClient eventoId={eventoId} bandMembers={bandMembers} />

        <EventAlignmentNotes eventId={eventoId} initialNotes={event.notes ?? null} />
      </div>
    </HydrationBoundary>
  )
}
