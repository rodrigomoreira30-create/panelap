import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { FinancasClient } from '@/components/financas/FinancasClient'
import { serializeFinance } from '@/lib/financas'
import { reconcileTeamCosts } from '@/lib/finance-service'

export default async function FinancasPage({
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

  const band = await prisma.band.findUnique({ where: { slug: bandSlug }, select: { id: true } })
  if (!band || band.id !== dbUser.band_id) return notFound()

  if (dbUser.role === 'musician') redirect(`/${bandSlug}`)

  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 0, 23, 59, 59)

  // Custos de equipe vêm da Formação: garante as linhas antes de somar os custos do mês.
  await reconcileTeamCosts({ bandId: dbUser.band_id })

  const [finances, availableEvents] = await Promise.all([
    prisma.eventFinance.findMany({
      where: { band_id: dbUser.band_id, event_date: { gte: startDate, lte: endDate } },
      include: {
        // event_musician (user_id + instrument): identidade estável para agrupar a matriz
        // "Equipe / Cachês" por membro+função — ver lib/financas-team-matrix.ts.
        items: {
          orderBy: { created_at: 'asc' },
          include: { event_musician: { select: { user_id: true, instrument: true } } },
        },
        payments: { orderBy: { payment_date: 'asc' } },
      },
      orderBy: { event_date: 'asc' },
    }),
    prisma.event.findMany({
      where: {
        band_id: dbUser.band_id,
        finance: null,
        event_date: { gte: startDate, lte: endDate },
      },
      select: { id: true, client_name: true, event_date: true },
      orderBy: { event_date: 'asc' },
    }),
  ])

  return (
    <div className="p-6 space-y-6">
      <FinancasClient
        bandSlug={bandSlug}
        initialFinances={finances.map(serializeFinance)}
        initialAvailableEvents={availableEvents.map(e => ({
          id: e.id,
          client_name: e.client_name,
          event_date: e.event_date.toISOString(),
        }))}
        initialMonth={month}
        initialYear={year}
      />
    </div>
  )
}
