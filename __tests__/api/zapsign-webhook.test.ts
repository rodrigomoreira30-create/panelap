import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/zapsign/route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/events/internal-bus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
}))

function createRequest(body: string): Request {
  return new Request('http://localhost:3000/api/webhooks/zapsign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('POST /api/webhooks/zapsign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when body is invalid JSON', async () => {
    const request = createRequest('not valid json')
    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 200 gracefully when token is missing from payload', async () => {
    const request = createRequest(JSON.stringify({ status: 'signed' }))
    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
  })

  it('returns 200 when contract is not found by zapsign_doc_id (unknown doc)', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce(null)

    const request = createRequest(JSON.stringify({ token: 'unknown-token', status: 'signed' }))
    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(vi.mocked(prisma.contract.update)).not.toHaveBeenCalled()
  })

  it('updates contract to signed and emits event when status is signed and contract exists', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { eventBus } = await import('@/lib/events/internal-bus')

    const existingContract = { id: 'contract-1', zapsign_doc_id: 'doc-token-abc' }
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce(existingContract as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce({ ...existingContract, status: 'signed' } as any)

    const request = createRequest(JSON.stringify({ token: 'doc-token-abc', status: 'signed' }))
    const response = await POST(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)

    expect(vi.mocked(prisma.contract.update)).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        status: 'signed',
        signed_at: expect.any(Date),
      }),
    })

    expect(vi.mocked(eventBus.emit)).toHaveBeenCalledWith('contract.signed', { contract_id: 'contract-1' })
  })

  it('returns 200 without updating when status is not signed (e.g. pending)', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { eventBus } = await import('@/lib/events/internal-bus')

    const existingContract = { id: 'contract-2', zapsign_doc_id: 'doc-token-xyz' }
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce(existingContract as any)

    const request = createRequest(JSON.stringify({ token: 'doc-token-xyz', status: 'pending' }))
    const response = await POST(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)

    expect(vi.mocked(prisma.contract.update)).not.toHaveBeenCalled()
    expect(vi.mocked(eventBus.emit)).not.toHaveBeenCalled()
  })
})
