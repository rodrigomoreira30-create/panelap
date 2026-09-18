import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { eventPaymentUpdateSchema } from '@/lib/validations/payment'

async function getPayment(
  sessionUser: { band_id: string },
  financeId: string,
  paymentId: string
) {
  const payment = await prisma.eventPayment.findUnique({
    where: { id: paymentId },
    include: { finance: { select: { band_id: true } } },
  })
  if (!payment || payment.finance_id !== financeId || payment.finance.band_id !== sessionUser.band_id) {
    return null
  }
  return payment
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, paymentId } = await params
  const payment = await getPayment(sessionUser, id, paymentId)
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = eventPaymentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const updated = await prisma.eventPayment.update({
    where: { id: paymentId },
    data: {
      payment_date:   parsed.data.payment_date   !== undefined ? new Date(parsed.data.payment_date) : undefined,
      amount:         parsed.data.amount         !== undefined ? parsed.data.amount                 : undefined,
      payment_method: parsed.data.payment_method !== undefined ? parsed.data.payment_method         : undefined,
      notes:          parsed.data.notes          !== undefined ? parsed.data.notes                  : undefined,
    },
  })

  return NextResponse.json({
    data: {
      ...updated,
      payment_date: updated.payment_date.toISOString(),
      amount:       parseFloat(updated.amount.toString()),
    },
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, paymentId } = await params
  const payment = await getPayment(sessionUser, id, paymentId)
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.eventPayment.delete({ where: { id: paymentId } })
  return NextResponse.json({ ok: true })
}
