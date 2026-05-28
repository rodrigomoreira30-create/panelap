import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/whatsapp/route'
import crypto from 'crypto'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
    band: {
      findFirst: vi.fn(),
    },
  },
}))

async function createMockRequest(body: string, secret?: string): Promise<Request> {
  let signature = ''
  if (secret) {
    const hash = crypto.createHmac('sha256', secret).update(body).digest('hex')
    signature = `sha256=${hash}`
  }

  return new Request('http://localhost:3000/api/webhooks/whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
    },
    body,
  })
}

describe('POST /api/webhooks/whatsapp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.WHATSAPP_WEBHOOK_SECRET
  })

  it('returns 401 when signature is invalid', async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'

    const request = await createMockRequest(
      JSON.stringify({ from: '5511999999999', body: 'Hello' }),
      'wrongsecret'
    )

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe('Invalid signature')
  })

  it('returns 400 when body is invalid JSON', async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'

    const invalidJson = 'not json'
    const request = await createMockRequest(invalidJson, 'secret123')

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 200 when payload is missing phone or content', async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'
    const body = JSON.stringify({ from: '5511999999999' })

    const request = await createMockRequest(body, 'secret123')

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
  })

  it('normalizes phone number by removing non-digits', async () => {
    const { prisma } = await import('@/lib/prisma')
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'

    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.band.findFirst).mockResolvedValueOnce({ id: 'band1' } as any)
    vi.mocked(prisma.lead.create).mockResolvedValueOnce({
      id: 'lead1',
    } as any)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg1',
    } as any)

    const body = JSON.stringify({
      from: '+55 (11) 99999-9999',
      body: 'Hello',
    })

    const request = await createMockRequest(body, 'secret123')
    const response = await POST(request)

    expect(response.status).toBe(200)
    const findCall = vi.mocked(prisma.lead.findFirst).mock.calls[0]
    const phoneFilter = findCall[0]?.where?.phone
    const containsValue = typeof phoneFilter === 'object' && phoneFilter !== null && 'contains' in phoneFilter
      ? (phoneFilter as { contains: string }).contains
      : undefined
    expect(containsValue).toBe('5511999999999')
  })

  it('stores message for existing lead', async () => {
    const { prisma } = await import('@/lib/prisma')
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'

    const existingLead = { id: 'lead1' }
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(existingLead as any)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg1',
    } as any)

    const body = JSON.stringify({
      from: '5511999999999',
      body: 'Hello from WhatsApp',
    })

    const request = await createMockRequest(body, 'secret123')
    const response = await POST(request)

    expect(response.status).toBe(200)
    const messageCall = vi.mocked(prisma.message.create).mock.calls[0]
    expect(messageCall[0].data).toEqual({
      lead_id: 'lead1',
      direction: 'in',
      content: 'Hello from WhatsApp',
      sent_by: 'client',
    })
  })

  it('creates new lead and message when lead does not exist', async () => {
    const { prisma } = await import('@/lib/prisma')
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'

    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.band.findFirst).mockResolvedValueOnce({ id: 'band1' } as any)
    vi.mocked(prisma.lead.create).mockResolvedValueOnce({
      id: 'newlead1',
    } as any)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg1',
    } as any)

    const body = JSON.stringify({
      from: '5511999999999',
      body: 'New contact',
    })

    const request = await createMockRequest(body, 'secret123')
    const response = await POST(request)

    expect(response.status).toBe(200)

    const leadCreateCall = vi.mocked(prisma.lead.create).mock.calls[0]
    expect(leadCreateCall[0].data).toEqual({
      band_id: 'band1',
      client_name: '5511999999999',
      phone: '5511999999999',
      event_type: 'other',
      status: 'new_lead',
    })
  })

  it('does not create lead when no band exists', async () => {
    const { prisma } = await import('@/lib/prisma')
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'

    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.band.findFirst).mockResolvedValueOnce(null)

    const body = JSON.stringify({
      from: '5511999999999',
      body: 'Hello',
    })

    const request = await createMockRequest(body, 'secret123')
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.lead.create)).not.toHaveBeenCalled()
  })

  it('handles both body and text payload fields', async () => {
    const { prisma } = await import('@/lib/prisma')
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'

    const existingLead = { id: 'lead1' }
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(existingLead as any)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg1',
    } as any)

    const bodyWithText = JSON.stringify({
      from: '5511999999999',
      text: 'Message via text field',
    })

    const request = await createMockRequest(bodyWithText, 'secret123')
    const response = await POST(request)

    expect(response.status).toBe(200)
    const messageCall = vi.mocked(prisma.message.create).mock.calls[0]
    expect(messageCall[0].data.content).toBe('Message via text field')
  })

  it('returns 401 when signature is missing and secret is set', async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = 'secret123'

    const body = JSON.stringify({ from: '5511999999999', body: 'Hello' })
    const request = await createMockRequest(body, '')

    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})
