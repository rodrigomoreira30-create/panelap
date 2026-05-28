import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/lib/generated/prisma/client'
import { getSessionUser } from '@/lib/auth/session'
import { templateUpdateSchema } from '@/lib/validations/contract'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dbUser = await getSessionUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = await prisma.contractTemplate.findFirst({
    where: { id, band_id: dbUser.band_id },
  })

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: template })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dbUser = await getSessionUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = templateUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const band_id = dbUser.band_id

  if (parsed.data.is_default) {
    try {
      const [, updated] = await prisma.$transaction([
        prisma.contractTemplate.updateMany({
          where: { band_id, is_default: true },
          data: { is_default: false },
        }),
        prisma.contractTemplate.update({
          where: { id, band_id },
          data: parsed.data,
        }),
      ])
      return NextResponse.json({ data: updated })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      throw e
    }
  }

  try {
    const updated = await prisma.contractTemplate.update({
      where: { id, band_id },
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dbUser = await getSessionUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const band_id = dbUser.band_id

  try {
    await prisma.contractTemplate.delete({
      where: { id, band_id },
    })
    return NextResponse.json({ data: { deleted: true } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw e
  }
}
