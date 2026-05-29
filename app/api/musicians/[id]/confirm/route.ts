import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action !== 'confirm' && action !== 'decline') {
    return new Response('<html><body><h1>Link inválido</h1></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const em = await prisma.eventMusician.findUnique({
    where: { id },
    include: { event: { select: { client_name: true, event_date: true } } },
  })

  if (!em) {
    return new Response('<html><body><h1>Convite não encontrado</h1></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (em.status !== 'pending') {
    return new Response(
      `<html><body><h1>Você já respondeu: ${em.status === 'confirmed' ? '✅ Confirmado' : '❌ Recusado'}</h1></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined'

  await prisma.eventMusician.update({
    where: { id },
    data: {
      status: newStatus,
      confirmed_at: newStatus === 'confirmed' ? new Date() : undefined,
    },
  })

  const message = newStatus === 'confirmed'
    ? `✅ Presença confirmada! Evento: ${em.event.client_name}`
    : `❌ Presença recusada. Obrigado por informar.`

  return new Response(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>${message}</h1></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const action = body.action

  if (action !== 'confirm' && action !== 'decline') {
    return NextResponse.json({ error: 'action deve ser "confirm" ou "decline"' }, { status: 422 })
  }

  const em = await prisma.eventMusician.findUnique({ where: { id } })
  if (!em) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined'

  const updated = await prisma.eventMusician.update({
    where: { id },
    data: {
      status: newStatus,
      confirmed_at: newStatus === 'confirmed' ? new Date() : undefined,
    },
  })

  return NextResponse.json({ data: updated })
}
