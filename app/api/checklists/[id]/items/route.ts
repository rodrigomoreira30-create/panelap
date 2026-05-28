import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@/lib/generated/prisma/client'

const schema = z.object({
  itemId: z.string().cuid(),
  done: z.boolean(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check
  const fullUser = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } })
  if (!fullUser || !['admin', 'producer'].includes(fullUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Verify checklist belongs to band
  const checklist = await prisma.checklist.findUnique({
    where: { id },
    include: { event: { select: { band_id: true } } },
  })

  if (!checklist || checklist.event.band_id !== sessionUser.band_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const updated = await prisma.checklistItem.update({
      where: { id: parsed.data.itemId, checklist_id: id },
      data: { done: parsed.data.done },
    })
    return NextResponse.json({ data: updated })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    throw e
  }
}
