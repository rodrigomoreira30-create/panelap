import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { runSdrAgent } from '@/lib/claude/agents/sdr-agent'
import { z } from 'zod'

const schema = z.object({
  lead_id: z.string().cuid(),
  message: z.string().min(1),
})

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  })
  if (!dbUser || !['admin', 'commercial'].includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data.lead_id, band_id: sessionUser.band_id },
  })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  await runSdrAgent({ lead_id: parsed.data.lead_id, new_message: parsed.data.message })
  return NextResponse.json({ data: { triggered: true } })
}
