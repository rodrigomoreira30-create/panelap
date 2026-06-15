import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const stageSchema = z.object({
  stages: z.array(z.object({
    key:   z.string().min(1).regex(/^[a-z0-9_]+$/),
    label: z.string().min(1).max(40),
  })).min(1),
})

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const band = await prisma.band.findUnique({
    where: { id: sessionUser.band_id },
    select: { pipeline_stages: true },
  })

  return NextResponse.json({ data: band?.pipeline_stages ?? null })
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
  const parsed = stageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const band = await prisma.band.update({
    where: { id: sessionUser.band_id },
    data: { pipeline_stages: parsed.data.stages },
    select: { pipeline_stages: true },
  })

  return NextResponse.json({ data: band.pipeline_stages })
}
