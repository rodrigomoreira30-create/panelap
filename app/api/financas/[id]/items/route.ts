import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

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
  if (!body.label) return NextResponse.json({ error: 'label obrigatório' }, { status: 422 })

  const item = await prisma.eventFinanceItem.create({
    data: {
      finance_id,
      category: body.category ?? 'custom',
      label:    body.label,
      amount:   body.amount ?? 0,
      paid:     body.paid   ?? false,
    },
  })

  return NextResponse.json({
    data: { ...item, amount: parseFloat(item.amount.toString()) }
  }, { status: 201 })
}
