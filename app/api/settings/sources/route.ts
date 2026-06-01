import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const sourcesSchema = z.object({
  sources: z.array(z.object({
    key:   z.string().min(1).regex(/^[a-z0-9_]+$/),
    label: z.string().min(1).max(40),
  })).min(1),
})

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const band = await prisma.band.findUnique({
    where: { id: sessionUser.band_id },
    select: { lead_sources: true },
  })

  return NextResponse.json({ data: band?.lead_sources ?? null })
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  })
  if (dbUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = sourcesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const band = await prisma.band.update({
    where: { id: sessionUser.band_id },
    data: { lead_sources: parsed.data.sources },
    select: { lead_sources: true },
  })

  return NextResponse.json({ data: band.lead_sources })
}
