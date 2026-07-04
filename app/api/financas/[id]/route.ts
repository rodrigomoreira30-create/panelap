import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { serializeFinance } from '@/lib/financas'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const finance = await prisma.eventFinance.findUnique({ where: { id } })
  if (!finance || finance.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.eventFinance.update({
    where: { id },
    data: {
      name:             body.name             !== undefined ? body.name             : undefined,
      client:           body.client           !== undefined ? body.client           : undefined,
      product:          body.product          !== undefined ? body.product          : undefined,
      event_date:       body.event_date ? new Date(body.event_date) : undefined,
      expected_revenue: body.expected_revenue !== undefined ? body.expected_revenue : undefined,
      received_amount:  body.received_amount  !== undefined ? body.received_amount  : undefined,
      notes:            body.notes            !== undefined ? body.notes            : undefined,
    },
    include: { items: { orderBy: { created_at: 'asc' } } },
  })

  return NextResponse.json({ data: serializeFinance(updated) })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const finance = await prisma.eventFinance.findUnique({ where: { id } })
  if (!finance || finance.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.eventFinance.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
