import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { round2 } from '@/lib/financas'

async function getItem(
  sessionUser: { band_id: string },
  financeId: string,
  itemId: string
) {
  const item = await prisma.eventFinanceItem.findUnique({
    where: { id: itemId },
    include: { finance: { select: { band_id: true, expected_revenue: true } } },
  })
  if (!item || item.finance_id !== financeId || item.finance.band_id !== sessionUser.band_id) {
    return null
  }
  return item
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, itemId } = await params
  const item = await getItem(sessionUser, id, itemId)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const revenue = parseFloat(item.finance.expected_revenue.toString())

  const data: Record<string, unknown> = {
    label: body.label !== undefined ? body.label : undefined,
    paid:  body.paid  !== undefined ? body.paid  : undefined,
    notes: body.notes !== undefined ? body.notes : undefined,
  }

  if (body.percent_of_revenue !== undefined) {
    data.percent_of_revenue = body.percent_of_revenue
    data.is_overridden = false
    data.amount = body.percent_of_revenue === null
      ? parseFloat(item.amount.toString())
      : round2((revenue * body.percent_of_revenue) / 100)
  } else if (body.amount !== undefined) {
    data.amount = body.amount
    if (item.percent_of_revenue !== null) data.is_overridden = true
  }

  const updated = await prisma.eventFinanceItem.update({
    where: { id: itemId },
    data,
  })

  return NextResponse.json({
    data: {
      ...updated,
      amount: parseFloat(updated.amount.toString()),
      percent_of_revenue: updated.percent_of_revenue !== null
        ? parseFloat(updated.percent_of_revenue.toString())
        : null,
    },
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, itemId } = await params
  const item = await getItem(sessionUser, id, itemId)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.eventFinanceItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
