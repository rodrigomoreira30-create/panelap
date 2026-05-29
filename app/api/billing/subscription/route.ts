import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getAsaasSubscriptions } from '@/lib/asaas/client'

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const band = await prisma.band.findUnique({
    where: { id: sessionUser.band_id },
    select: { asaas_id: true, plan: true },
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  if (!band.asaas_id) {
    return NextResponse.json({
      data: { status: 'no_subscription', plan: band.plan, asaas_id: null },
    })
  }

  try {
    const { data: subscriptions } = await getAsaasSubscriptions(band.asaas_id)
    const active = subscriptions.find(s => s.status === 'ACTIVE') ?? subscriptions[0]

    return NextResponse.json({
      data: {
        status:   active?.status ?? 'NOT_FOUND',
        plan:     band.plan,
        value:    active?.value,
        next_due: active?.nextDueDate,
        asaas_id: band.asaas_id,
      },
    })
  } catch {
    return NextResponse.json({
      data: { status: 'error', plan: band.plan },
    })
  }
}
