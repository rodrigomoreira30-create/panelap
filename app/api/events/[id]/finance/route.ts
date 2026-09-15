import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { serializeFinance, computeEventFinance } from '@/lib/financas'
import { getOrCreateEventFinance } from '@/lib/finance-service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: eventId } = await params
  const event = await prisma.event.findFirst({
    where: { id: eventId, band_id: sessionUser.band_id },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const finance = await getOrCreateEventFinance(eventId)
  const data = serializeFinance(finance)

  return NextResponse.json({ data, totals: computeEventFinance(data) })
}
