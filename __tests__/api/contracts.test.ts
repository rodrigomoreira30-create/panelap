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
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1', role: 'admin' }),
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
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1', role: 'admin' })
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
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1', role: 'admin' })
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
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1', role: 'admin' })

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

// ── Test 5: POST /api/contracts/[id]/approve (marcar como enviado) ───────────
describe('POST /api/contracts/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marca o contrato como enviado sem chamar serviço externo de assinatura', async () => {
    const { prisma } = await import('@/lib/prisma')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({ id: 'contract-1', status: 'draft' } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce({ id: 'contract-1', status: 'sent', reviewed_by: 'user-1' } as any)

    const response = await APPROVE(makeParamRequest('POST'), { params: mockParams })

    expect(response.status).toBe(200)
    expect((await response.json()).data.status).toBe('sent')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.contract.findFirst)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'contract-1', event: { band_id: 'band-1' } } })
    )
    expect(vi.mocked(prisma.contract.update)).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { status: 'sent', reviewed_by: 'user-1' },
    })
    fetchSpy.mockRestore()
  })

  it('retorna 409 e não altera contrato já assinado', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({ id: 'contract-1', status: 'signed' } as any)

    const response = await APPROVE(makeParamRequest('POST'), { params: mockParams })

    expect(response.status).toBe(409)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('retorna 404 para contrato de outra banda', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce(null)

    const response = await APPROVE(makeParamRequest('POST'), { params: mockParams })

    expect(response.status).toBe(404)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })
})

// ── Test 6: PATCH /api/contracts/[id] (marcar como assinado) ─────────────────
describe('PATCH /api/contracts/[id] — assinatura manual', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ao marcar como assinado grava signed_at e emite contract.signed', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { eventBus } = await import('@/lib/events/internal-bus')
    const emitSpy = vi.spyOn(eventBus, 'emit')

    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({ id: 'contract-1', status: 'sent', signed_at: null } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce({ id: 'contract-1', status: 'signed' } as any)

    const response = await PATCH(makeParamRequest('PATCH', { status: 'signed' }), { params: mockParams })

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.contract.update)).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { status: 'signed', signed_at: expect.any(Date) },
    })
    expect(emitSpy).toHaveBeenCalledWith('contract.signed', { contract_id: 'contract-1' })
    emitSpy.mockRestore()
  })

  it('não reemite o evento nem sobrescreve signed_at de contrato já assinado', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { eventBus } = await import('@/lib/events/internal-bus')
    const emitSpy = vi.spyOn(eventBus, 'emit')
    const signedAt = new Date('2026-09-01T12:00:00Z')

    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({ id: 'contract-1', status: 'signed', signed_at: signedAt } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce({ id: 'contract-1', status: 'signed' } as any)

    await PATCH(makeParamRequest('PATCH', { status: 'signed' }), { params: mockParams })

    expect(vi.mocked(prisma.contract.update)).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { status: 'signed' },
    })
    expect(emitSpy).not.toHaveBeenCalled()
    emitSpy.mockRestore()
  })
})

// ── Test 7: permissões ───────────────────────────────────────────────────────
describe('Contratos — permissões', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 sem autenticação', async () => {
    const { getSessionUser } = await import('@/lib/auth/session')
    vi.mocked(getSessionUser).mockResolvedValueOnce(null)

    const response = await GET(makeRequest('GET'))
    expect(response.status).toBe(401)
  })

  it.each([
    ['GET /api/contracts', () => GET(makeRequest('GET'))],
    ['GET /api/contracts/[id]', () => GET_ONE(makeParamRequest('GET'), { params: mockParams })],
    ['PATCH /api/contracts/[id]', () => PATCH(makeParamRequest('PATCH', { status: 'signed' }), { params: mockParams })],
    ['POST /api/contracts/[id]/approve', () => APPROVE(makeParamRequest('POST'), { params: mockParams })],
  ])('músico recebe 403 em %s', async (_name, call) => {
    const { prisma } = await import('@/lib/prisma')
    const { getSessionUser } = await import('@/lib/auth/session')
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'mus-1', band_id: 'band-1', supabase_id: 'sup-9', role: 'musician' })

    const response = await call()

    expect(response.status).toBe(403)
    expect(prisma.contract.findMany).not.toHaveBeenCalled()
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })
})
