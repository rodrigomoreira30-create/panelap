import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, PATCH, DELETE } from '@/app/api/event-musicians/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    event: { findFirst: vi.fn() },
    eventMusician: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('@/lib/finance-service', () => ({
  syncMusicianCost: vi.fn().mockResolvedValue(undefined),
  removeMusicianCost: vi.fn(),
}))

function makeDeleteRequest(qs: string): Request {
  return new Request(`http://localhost:3000/api/event-musicians${qs}`, { method: 'DELETE' })
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/event-musicians', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/event-musicians', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/event-musicians — bloqueio de cachê pago', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 409 quando o custo vinculado já está pago e force não foi passado', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { removeMusicianCost } = await import('@/lib/finance-service')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'em-1',
      event: { band_id: 'band-1' },
    } as any)
    vi.mocked(removeMusicianCost).mockResolvedValueOnce({ blocked: true })

    const response = await DELETE(makeDeleteRequest('?id=em-1'))
    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json.requiresConfirmation).toBe(true)
    expect(prisma.eventMusician.delete).not.toHaveBeenCalled()
  })

  it('remove com sucesso quando force=true', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { removeMusicianCost } = await import('@/lib/finance-service')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'em-1',
      event: { band_id: 'band-1' },
    } as any)
    vi.mocked(removeMusicianCost).mockResolvedValueOnce({ blocked: false })
    vi.mocked(prisma.eventMusician.delete).mockResolvedValueOnce({ id: 'em-1' } as any)

    const response = await DELETE(makeDeleteRequest('?id=em-1&force=true'))
    expect(response.status).toBe(200)
    expect(removeMusicianCost).toHaveBeenCalledWith('em-1', true)
  })
})

describe('POST /api/event-musicians — sincronização de custo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cria o EventMusician e dispara syncMusicianCost com o id criado', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { syncMusicianCost } = await import('@/lib/finance-service')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({
      id: 'cevent000000000000000001',
      band_id: 'band-1',
      client_name: 'Cliente Teste',
      event_date: new Date('2026-01-01'),
    } as any)
    vi.mocked(prisma.eventMusician.create).mockResolvedValueOnce({
      id: 'cem10000000000000000001',
      event_id: 'cevent000000000000000001',
      user_id: null,
      instrument: 'Baixo',
      cache_value: 300,
      status: 'pending',
      user: null,
    } as any)

    const response = await POST(makePostRequest({
      event_id: 'cevent000000000000000001',
      instrument: 'Baixo',
      cache_value: 300,
    }))

    expect(response.status).toBe(201)
    expect(prisma.eventMusician.create).toHaveBeenCalled()
    expect(syncMusicianCost).toHaveBeenCalledWith('cem10000000000000000001')
  })
})

describe('PATCH /api/event-musicians — sincronização de custo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispara syncMusicianCost quando cache_value é enviado no body', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { syncMusicianCost } = await import('@/lib/finance-service')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'cem10000000000000000001',
      user_id: null,
      event: { band_id: 'band-1', client_name: 'Cliente Teste', event_date: new Date('2026-01-01') },
    } as any)
    vi.mocked(prisma.eventMusician.update).mockResolvedValueOnce({
      id: 'cem10000000000000000001',
      cache_value: 500,
      user: null,
    } as any)

    const response = await PATCH(makePatchRequest({
      id: 'cem10000000000000000001',
      cache_value: 500,
    }))

    expect(response.status).toBe(200)
    expect(syncMusicianCost).toHaveBeenCalledWith('cem10000000000000000001')
  })

  it('NÃO dispara syncMusicianCost quando cache_value não está presente no body', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { syncMusicianCost } = await import('@/lib/finance-service')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'cem10000000000000000001',
      user_id: null,
      event: { band_id: 'band-1', client_name: 'Cliente Teste', event_date: new Date('2026-01-01') },
    } as any)
    vi.mocked(prisma.eventMusician.update).mockResolvedValueOnce({
      id: 'cem10000000000000000001',
      user_id: null,
      user: null,
    } as any)

    const response = await PATCH(makePatchRequest({
      id: 'cem10000000000000000001',
    }))

    expect(response.status).toBe(200)
    expect(syncMusicianCost).not.toHaveBeenCalled()
  })
})
