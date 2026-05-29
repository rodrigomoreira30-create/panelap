import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getAsaasCustomerPortalUrl } from '@/lib/asaas/client'

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const band = await prisma.band.findUnique({
    where: { id: sessionUser.band_id },
    select: { asaas_id: true },
  })

  if (!band?.asaas_id) {
    return NextResponse.json({ error: 'Sem assinatura ativa' }, { status: 400 })
  }

  const url = await getAsaasCustomerPortalUrl(band.asaas_id)
  return NextResponse.json({ data: { url } })
}
