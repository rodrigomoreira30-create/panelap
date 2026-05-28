import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/session'

const contractCreateSchema = z.object({
  event_id: z.string().cuid(),
  template_id: z.string().cuid(),
})

export async function GET(_request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contracts = await prisma.contract.findMany({
    where: { event: { band_id: sessionUser.band_id } },
    include: { event: true, template: true },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ data: contracts })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = contractCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { event_id, template_id } = parsed.data

  const event = await prisma.event.findFirst({
    where: { id: event_id, band_id: sessionUser.band_id },
  })
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const template = await prisma.contractTemplate.findFirst({
    where: { id: template_id, band_id: sessionUser.band_id },
  })
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const contract = await prisma.contract.create({
    data: { event_id, template_id, status: 'draft' },
  })

  return NextResponse.json({ data: contract }, { status: 201 })
}
