import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateICS, type ICSEvent } from '@/lib/ics'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
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

  if (!musician) return new NextResponse(null, { status: 404 })

  const events: ICSEvent[] = musician.event_musicians.map(em => ({
    id:            em.id,
    client_name:   em.event.client_name,
    event_type:    em.event.event_type,
    event_date:    em.event.event_date,
    event_time:    em.event.event_time,
    venue_name:    em.event.venue_name ?? '',
    venue_address: em.event.venue_address,
    status:        em.status,
  }))

  const ics = generateICS(musician.name, events)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="minha-agenda.ics"',
      'Cache-Control':       'no-store',
    },
  })
}
