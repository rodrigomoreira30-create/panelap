import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { EventList } from '@/components/producao/EventList'

export default async function ProducaoPage({
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

  // Validate band slug matches the user's band
  const band = await prisma.band.findUnique({
    where: { slug: bandSlug },
    select: { id: true },
  })
  if (!band || band.id !== dbUser.band_id) return notFound()

  const events = await prisma.event.findMany({
    where: {
      band_id: dbUser.band_id,
      status: { in: ['contracted', 'active'] },
    },
    include: {
      checklists: {
        include: { items: { select: { id: true, done: true } } },
      },
      event_musicians: { select: { id: true, status: true } },
    },
    orderBy: { event_date: 'asc' },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Produção</h1>
        <p className="text-gray-500 text-sm mt-1">Eventos ativos e em preparação</p>
      </div>
      <div className="border rounded-lg bg-white overflow-hidden">
        <EventList events={events as any} bandSlug={bandSlug} />
      </div>
    </div>
  )
}
