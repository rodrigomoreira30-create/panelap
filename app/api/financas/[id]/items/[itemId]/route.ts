import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

async function getItem(
  sessionUser: { band_id: string },
  financeId: string,
  itemId: string
) {
  const item = await prisma.eventFinanceItem.findUnique({
    where: { id: itemId },
    include: { finance: { select: { band_id: true } } },
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
  const updated = await prisma.eventFinanceItem.update({
    where: { id: itemId },
    data: {
      label:  body.label  !== undefined ? body.label  : undefined,
      amount: body.amount !== undefined ? body.amount : undefined,
      paid:   body.paid   !== undefined ? body.paid   : undefined,
      notes:  body.notes  !== undefined ? body.notes  : undefined,
    },
  })

  return NextResponse.json({
    data: { ...updated, amount: parseFloat(updated.amount.toString()) }
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
