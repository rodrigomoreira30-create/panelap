import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/lib/generated/prisma/client'
import { getSessionUser } from '@/lib/auth/session'

const contractUpdateSchema = z
  .object({
    status: z.enum(['draft', 'pending_review', 'sent', 'signed']).optional(),
    pdf_url: z.string().url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' })

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contract = await prisma.contract.findFirst({
    where: { id, event: { band_id: sessionUser.band_id } },
    include: { event: { include: { lead: true } }, template: true },
  })

  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: contract })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = contractUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const contract = await prisma.contract.findFirst({
      where: { id, event: { band_id: sessionUser.band_id } },
    })
    if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.contract.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json({ data: updated })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw e
  }
}
