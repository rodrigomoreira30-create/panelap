import { NextResponse } from 'next/server'
import { forbiddenUnlessStaff } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/session'

// Aprovação = marcar como enviado ao cliente. O envio para assinatura é feito fora do
// sistema (sem integração de assinatura eletrônica); a assinatura é registrada depois
// pelo PATCH /api/contracts/[id] com status 'signed'.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const forbidden = forbiddenUnlessStaff(sessionUser)
  if (forbidden) return forbidden

  const contract = await prisma.contract.findFirst({
    where: { id, event: { band_id: sessionUser.band_id } },
    select: { id: true, status: true },
  })

  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (contract.status !== 'draft' && contract.status !== 'pending_review') {
    return NextResponse.json(
      { error: 'Contrato já foi enviado ou assinado' },
      { status: 409 }
    )
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: { status: 'sent', reviewed_by: sessionUser.id },
  })

  return NextResponse.json({ data: updated })
}
