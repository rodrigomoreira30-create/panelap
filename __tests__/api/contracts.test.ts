import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/contracts/route'
import { GET as GET_ONE, PATCH } from '@/app/api/contracts/[id]/route'
import { POST as APPROVE } from '@/app/api/contracts/[id]/approve/route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    event: { findFirst: vi.fn() },
    contractTemplate: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/zapsign/client', () => ({
  createZapSignDocument: vi.fn().mockResolvedValue({
    token: 'zap-token-123',
    signers: [{ sign_url: 'https://zapsign.com/sign/abc' }],
  }),
}))

vi.mock('@/lib/contracts/template-fill', () => ({
  fillTemplate: vi.fn().mockReturnValue('Filled contract content'),
  buildContractData: vi.fn().mockReturnValue({ cliente_nome: 'Test Client' }),
}))

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost:3000/api/contracts', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function makeParamRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost:3000/api/contracts/contract-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const mockParams = Promise.resolve({ id: 'contract-1' })

// ── Test 1: GET /api/contracts ────────────────────────────────────────────────
describe('GET /api/contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns contracts for the authenticated band', async () => {
    const { prisma } = await import('@/lib/prisma')

    const mockContracts = [
      {
        id: 'contract-1',
        event_id: 'event-1',
        template_id: 'tmpl-1',
        status: 'draft',
        created_at: new Date(),
        event: { id: 'event-1', band_id: 'band-1', client_name: 'Test Client' },
        template: { id: 'tmpl-1', name: 'Standard Template' },
      },
    ]
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce(mockContracts as any)

    const request = makeRequest('GET')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveLength(1)
    expect(vi.mocked(prisma.contract.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { event: { band_id: 'band-1' } },
        orderBy: { created_at: 'desc' },
      })
    )
  })
})

// ── Test 2: POST /api/contracts — creates draft contract ──────────────────────
describe('POST /api/contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a draft contract with valid body', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getSessionUser } = await import('@/lib/auth/session')

    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' })
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({
      id: 'event-1',
      band_id: 'band-1',
      client_name: 'Test Client',
    } as any)
    vi.mocked(prisma.contractTemplate.findFirst).mockResolvedValueOnce({
      id: 'tmpl-1',
      band_id: 'band-1',
      name: 'Standard Template',
    } as any)

    const created = {
      id: 'contract-new',
      event_id: 'event-1',
      template_id: 'tmpl-1',
      status: 'draft',
      created_at: new Date(),
    }
    vi.mocked(prisma.contract.create).mockResolvedValueOnce(created as any)

    const request = makeRequest('POST', { event_id: 'clxxxxxxxxxxxxxxxxxxxxxx', template_id: 'clxxxxxxxxxxxxxxxxxxxxxy' })
    const response = await POST(request)

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.data.status).toBe('draft')
    expect(vi.mocked(prisma.contract.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft' }),
      })
    )
  })

  // ── Test 3: POST /api/contracts — 404 when event not found ──────────────────
  it('returns 404 when event does not belong to band', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getSessionUser } = await import('@/lib/auth/session')

    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' })
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce(null)

    const request = makeRequest('POST', { event_id: 'clxxxxxxxxxxxxxxxxxxxxxx', template_id: 'clxxxxxxxxxxxxxxxxxxxxxy' })
    const response = await POST(request)

    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error).toMatch(/event/i)
  })
})

// ── Test 4: GET /api/contracts/[id] ───────────────────────────────────────────
describe('GET /api/contracts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a single contract with relations', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getSessionUser } = await import('@/lib/auth/session')

    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' })

    const mockContract = {
      id: 'contract-1',
      event_id: 'event-1',
      template_id: 'tmpl-1',
      status: 'draft',
      created_at: new Date(),
      event: {
        id: 'event-1',
        band_id: 'band-1',
        client_name: 'Test Client',
        lead: { id: 'lead-1', client_name: 'Test Client', phone: '11999999999' },
      },
      template: { id: 'tmpl-1', name: 'Standard Template', content: 'Hello {{cliente_nome}}' },
    }
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce(mockContract as any)

    const request = makeParamRequest('GET')
    const response = await GET_ONE(request, { params: mockParams })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.id).toBe('contract-1')
    expect(json.data.event.lead).toBeDefined()
    expect(vi.mocked(prisma.contract.findFirst)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contract-1', event: { band_id: 'band-1' } },
      })
    )
  })
})

// ── Test 5: POST /api/contracts/[id]/approve ──────────────────────────────────
describe('POST /api/contracts/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends contract to ZapSign and updates DB', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getSessionUser } = await import('@/lib/auth/session')
    const { createZapSignDocument } = await import('@/lib/zapsign/client')

    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' })

    const mockContract = {
      id: 'contract-1',
      event_id: 'event-1',
      template_id: 'tmpl-1',
      status: 'draft',
      event: {
        id: 'event-1',
        band_id: 'band-1',
        client_name: 'Test Client',
        lead: {
          id: 'lead-1',
          client_name: 'Test Client',
          phone: '11999999999',
          event_type: 'wedding',
          event_date: new Date('2026-08-15'),
          city: 'São Paulo',
          venue_name: 'Espaço Fest',
          budget: null,
          observations: null,
        },
      },
      template: { id: 'tmpl-1', name: 'Standard Template', content: 'Hello {{cliente_nome}}' },
    }
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce(mockContract as any)

    const updatedContract = {
      ...mockContract,
      status: 'sent',
      zapsign_doc_id: 'zap-token-123',
      zapsign_link: 'https://zapsign.com/sign/abc',
      reviewed_by: 'user-1',
    }
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(updatedContract as any)

    const request = makeParamRequest('POST')
    const response = await APPROVE(request, { params: mockParams })

    expect(response.status).toBe(200)
    const json = await response.json()

    expect(createZapSignDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining('Test Client'),
        signers: expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Client',
            phone_number: '11999999999',
          }),
        ]),
      })
    )

    expect(vi.mocked(prisma.contract.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contract-1' },
        data: expect.objectContaining({
          zapsign_doc_id: 'zap-token-123',
          zapsign_link: 'https://zapsign.com/sign/abc',
          status: 'sent',
          reviewed_by: 'user-1',
        }),
      })
    )

    expect(json.data.status).toBe('sent')
    expect(json.zapDoc).toBeDefined()
  })
})
