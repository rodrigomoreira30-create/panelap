import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/contract-templates/route'
import { GET as GET_ONE, PATCH, DELETE } from '@/app/api/contract-templates/[id]/route'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
      }),
    },
  }),
}))

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost:3000/api/contract-templates', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/contract-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns templates for the authenticated band', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-1',
      band_id: 'band-1',
    } as any)

    const mockTemplates = [
      { id: 'tmpl-1', band_id: 'band-1', name: 'Template A', content: 'Content A', is_default: true, created_at: new Date() },
      { id: 'tmpl-2', band_id: 'band-1', name: 'Template B', content: 'Content B', is_default: false, created_at: new Date() },
    ]
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValueOnce(mockTemplates as any)

    const request = makeRequest('GET')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveLength(2)
    expect(vi.mocked(prisma.contractTemplate.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { band_id: 'band-1' },
        orderBy: { created_at: 'desc' },
      })
    )
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)

    const request = makeRequest('GET')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})

describe('POST /api/contract-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a template with valid body', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-1',
      band_id: 'band-1',
    } as any)

    vi.mocked(prisma.contractTemplate.updateMany).mockResolvedValueOnce({ count: 0 } as any)

    const created = {
      id: 'tmpl-new',
      band_id: 'band-1',
      name: 'Contrato Padrão',
      content: 'Este é o conteúdo do contrato padrão.',
      is_default: true,
      created_at: new Date(),
    }
    vi.mocked(prisma.contractTemplate.create).mockResolvedValueOnce(created as any)

    const request = makeRequest('POST', {
      name: 'Contrato Padrão',
      content: 'Este é o conteúdo do contrato padrão.',
      is_default: true,
    })
    const response = await POST(request)

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.data.name).toBe('Contrato Padrão')
    expect(vi.mocked(prisma.contractTemplate.updateMany)).toHaveBeenCalledWith({
      where: { band_id: 'band-1', is_default: true },
      data: { is_default: false },
    })
  })

  it('returns 400 with invalid body (name too short)', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-1',
      band_id: 'band-1',
    } as any)

    const request = makeRequest('POST', {
      name: 'X', // too short — min 2 chars but fails because "X" is 1 char
      content: 'Content long enough',
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBeDefined()
  })
})

describe('PATCH /api/contract-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates a template by id', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-1',
      band_id: 'band-1',
    } as any)

    const updated = {
      id: 'tmpl-1',
      band_id: 'band-1',
      name: 'Updated Name',
      content: 'Updated content that is long enough',
      is_default: false,
      created_at: new Date(),
    }
    vi.mocked(prisma.contractTemplate.update).mockResolvedValueOnce(updated as any)

    const request = new Request('http://localhost:3000/api/contract-templates/tmpl-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    const params = Promise.resolve({ id: 'tmpl-1' })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.name).toBe('Updated Name')
    expect(vi.mocked(prisma.contractTemplate.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tmpl-1', band_id: 'band-1' },
      })
    )
  })
})

describe('DELETE /api/contract-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a template by id', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-1',
      band_id: 'band-1',
    } as any)

    vi.mocked(prisma.contractTemplate.delete).mockResolvedValueOnce({
      id: 'tmpl-1',
    } as any)

    const request = new Request('http://localhost:3000/api/contract-templates/tmpl-1', {
      method: 'DELETE',
    })
    const params = Promise.resolve({ id: 'tmpl-1' })
    const response = await DELETE(request, { params })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.deleted).toBe(true)
    expect(vi.mocked(prisma.contractTemplate.delete)).toHaveBeenCalledWith({
      where: { id: 'tmpl-1', band_id: 'band-1' },
    })
  })
})
