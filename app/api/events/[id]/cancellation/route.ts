import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { eventCancelSchema } from '@/lib/validations/event'

// Cancelamento é operacional, não exclusão: só cancelled_at/cancellation_reason mudam.
// Event.status, financeiro, contratos, anexos e equipe ficam intactos, então reativar
// (DELETE) basta limpar esses campos para o evento voltar à situação anterior.

async function authorize(id: string) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const fullUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  })
  if (!fullUser || !['admin', 'producer'].includes(fullUser.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const existing = await prisma.event.findFirst({
    where: { id, band_id: sessionUser.band_id },
    select: { id: true, cancelled_at: true },
  })
  if (!existing) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  return { existing }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { existing, error } = await authorize(id)
  if (error) return error

  if (existing.cancelled_at) {
    return NextResponse.json({ error: 'Evento já está cancelado' }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = eventCancelSchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const reason = parsed.data.reason?.trim() || null
  const updated = await prisma.event.update({
    where: { id },
    data: { cancelled_at: new Date(), cancellation_reason: reason },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { existing, error } = await authorize(id)
  if (error) return error

  if (!existing.cancelled_at) {
    return NextResponse.json({ error: 'Evento não está cancelado' }, { status: 409 })
  }

  const updated = await prisma.event.update({
    where: { id },
    data: { cancelled_at: null, cancellation_reason: null },
  })

  return NextResponse.json({ data: updated })
}
