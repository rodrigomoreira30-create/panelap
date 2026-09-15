import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DELETE } from '@/app/api/event-musicians/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    eventMusician: { findUnique: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('@/lib/finance-service', () => ({
  syncMusicianCost: vi.fn(),
  removeMusicianCost: vi.fn(),
}))

function makeDeleteRequest(qs: string): Request {
  return new Request(`http://localhost:3000/api/event-musicians${qs}`, { method: 'DELETE' })
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
