import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runSdrAgent } from '@/lib/claude/agents/sdr-agent'
import crypto from 'crypto'

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return `sha256=${expected}` === signature
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const phone = payload.from as string | undefined
  const content = (payload.body ?? payload.text ?? '') as string

  if (!phone || !content) {
    return NextResponse.json({ ok: true })
  }

  const normalizedPhone = phone.replace(/\D/g, '')

  let lead: { id: string } | null = null

  try {
    const existingLead = await prisma.lead.findFirst({
      where: { phone: { contains: normalizedPhone } },
    })

    if (existingLead) {
      lead = existingLead
      await prisma.message.create({
        data: {
          lead_id: lead.id,
          direction: 'in',
          content,
          sent_by: 'client',
        },
      })
    } else {
      const firstBand = await prisma.band.findFirst({ select: { id: true } })
      if (firstBand) {
        const newLead = await prisma.lead.create({
          data: {
            band_id: firstBand.id,
            client_name: phone,
            phone: normalizedPhone,
            event_type: 'other',
            status: 'new_lead',
          },
        })
        lead = newLead
        await prisma.message.create({
          data: {
            lead_id: newLead.id,
            direction: 'in',
            content,
            sent_by: 'client',
          },
        })
      }
    }
  } catch {
    // Log but don't expose internals — return 200 so provider doesn't retry
    console.error('WhatsApp webhook DB error')
  }

  if (lead) {
    runSdrAgent({ lead_id: lead.id, new_message: content })
      .catch(err => console.error('SDR Agent error:', err))
  }

  return NextResponse.json({ ok: true })
}
