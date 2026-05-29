import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const token = request.headers.get('asaas-access-token')
  if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload.event as string | undefined
  const customerId = (
    (payload.payment as Record<string, unknown> | undefined)?.customer ??
    (payload.subscription as Record<string, unknown> | undefined)?.customer
  ) as string | undefined

  if (!customerId) return NextResponse.json({ ok: true })

  const band = await prisma.band.findFirst({ where: { asaas_id: customerId } })
  if (!band) {
    console.warn(`Asaas webhook: banda não encontrada para customer ${customerId}`)
    return NextResponse.json({ ok: true })
  }

  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    console.log(`Pagamento recebido para banda ${band.id}`)
  }

  if (event === 'PAYMENT_OVERDUE') {
    console.warn(`Pagamento em atraso para banda ${band.id}`)
  }

  if (event === 'SUBSCRIPTION_INACTIVATED') {
    console.warn(`Assinatura inativada para banda ${band.id}`)
  }

  return NextResponse.json({ ok: true })
}
