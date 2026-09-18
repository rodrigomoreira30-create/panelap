import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { eventPaymentCreateSchema } from '@/lib/validations/payment'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: finance_id } = await params
  const finance = await prisma.eventFinance.findUnique({ where: { id: finance_id } })
  if (!finance || finance.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const parsed = eventPaymentCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const payment = await prisma.eventPayment.create({
    data: {
      finance_id,
      payment_date:   new Date(parsed.data.payment_date),
      amount:         parsed.data.amount,
      payment_method: parsed.data.payment_method,
      notes:          parsed.data.notes ?? null,
    },
  })

  return NextResponse.json({
    data: {
      ...payment,
      payment_date: payment.payment_date.toISOString(),
      amount:       parseFloat(payment.amount.toString()),
    },
  }, { status: 201 })
}
