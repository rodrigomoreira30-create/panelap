import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, DELETE } from '@/app/api/events/[id]/cancellation/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

const URL_CANCEL = 'http://localhost:3000/api/events/event-1/cancellation'
const params = () => Promise.resolve({ id: 'event-1' })

function req(method: string, body?: unknown): Request {
  return new Request(URL_CANCEL, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function setup({ role = 'admin', event }: { role?: string; event?: Record<string, unknown> | null }) {
  const { prisma } = await import('@/lib/prisma')
  const { getSessionUser } = await import('@/lib/auth/session')
  vi.mocked(getSessionUser).mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' } as any)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ role } as any)
  vi.mocked(prisma.event.findFirst).mockResolvedValue(
    (event === undefined
      ? { id: 'event-1', band_id: 'band-1', status: 'contracted', cancelled_at: null, cancellation_reason: null }
      : event) as any
  )
  vi.mocked(prisma.event.update).mockImplementation((async ({ data }: any) => ({
    id: 'event-1', status: 'contracted', ...data,
  })) as any)
  return prisma
}

describe('POST /api/events/[id]/cancellation — cancelar evento', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca cancelled_at e grava o motivo, sem tocar no status nem em outros campos', async () => {
    const prisma = await setup({})
    const res = await POST(req('POST', { reason: '  Cliente desistiu  ' }), { params: params() })

    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.event.update).mock.calls[0][0] as any
    expect(call.where).toEqual({ id: 'event-1' })
    expect(Object.keys(call.data).sort()).toEqual(['cancellation_reason', 'cancelled_at'])
    expect(call.data.cancelled_at).toBeInstanceOf(Date)
    expect(call.data.cancellation_reason).toBe('Cliente desistiu')
    // Cancelamento não exclui nem cria nada
    expect(prisma.event.delete).not.toHaveBeenCalled()
    expect(prisma.event.create).not.toHaveBeenCalled()

    const json = await res.json()
    expect(json.data.status).toBe('contracted')
    expect(json.data.cancellation_reason).toBe('Cliente desistiu')
  })

  it('motivo é opcional (vazio → null)', async () => {
    const prisma = await setup({})
    const res = await POST(req('POST', { reason: '   ' }), { params: params() })
    expect(res.status).toBe(200)
    expect((vi.mocked(prisma.event.update).mock.calls[0][0] as any).data.cancellation_reason).toBeNull()
  })

  it('aceita requisição sem corpo', async () => {
    const prisma = await setup({})
    const res = await POST(req('POST'), { params: params() })
    expect(res.status).toBe(200)
    expect((vi.mocked(prisma.event.update).mock.calls[0][0] as any).data.cancellation_reason).toBeNull()
  })

  it('funciona para evento com data passada', async () => {
    const prisma = await setup({
      event: { id: 'event-1', band_id: 'band-1', status: 'done', event_date: new Date('2025-01-10'), cancelled_at: null },
    })
    const res = await POST(req('POST', {}), { params: params() })
    expect(res.status).toBe(200)
    expect(prisma.event.update).toHaveBeenCalledTimes(1)
  })

  it('409 se o evento já está cancelado', async () => {
    const prisma = await setup({
      event: { id: 'event-1', band_id: 'band-1', status: 'contracted', cancelled_at: new Date() },
    })
    const res = await POST(req('POST', {}), { params: params() })
    expect(res.status).toBe(409)
    expect(prisma.event.update).not.toHaveBeenCalled()
  })

  it('404 se o evento não pertence à banda', async () => {
    const prisma = await setup({ event: null })
    const res = await POST(req('POST', {}), { params: params() })
    expect(res.status).toBe(404)
    expect(prisma.event.update).not.toHaveBeenCalled()
  })

  it('403 para quem não é admin/producer', async () => {
    const prisma = await setup({ role: 'musician' })
    const res = await POST(req('POST', {}), { params: params() })
    expect(res.status).toBe(403)
    expect(prisma.event.update).not.toHaveBeenCalled()
  })

  it('401 sem sessão', async () => {
    await setup({})
    const { getSessionUser } = await import('@/lib/auth/session')
    vi.mocked(getSessionUser).mockResolvedValueOnce(null as any)
    const res = await POST(req('POST', {}), { params: params() })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/events/[id]/cancellation — reativar evento', () => {
  beforeEach(() => vi.clearAllMocks())

  it('limpa cancelled_at/motivo e mantém o status original (restaura a situação anterior)', async () => {
    const prisma = await setup({
      event: { id: 'event-1', band_id: 'band-1', status: 'active', cancelled_at: new Date(), cancellation_reason: 'x' },
    })
    vi.mocked(prisma.event.update).mockImplementationOnce((async ({ data }: any) => ({
      id: 'event-1', status: 'active', ...data,
    })) as any)

    const res = await DELETE(req('DELETE'), { params: params() })
    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.event.update).mock.calls[0][0] as any
    expect(call.data).toEqual({ cancelled_at: null, cancellation_reason: null })
    expect(prisma.event.create).not.toHaveBeenCalled()

    const json = await res.json()
    expect(json.data.status).toBe('active')
    expect(json.data.cancelled_at).toBeNull()
  })

  it('409 se o evento não está cancelado', async () => {
    const prisma = await setup({})
    const res = await DELETE(req('DELETE'), { params: params() })
    expect(res.status).toBe(409)
    expect(prisma.event.update).not.toHaveBeenCalled()
  })

  it('403 para quem não é admin/producer', async () => {
    const prisma = await setup({
      role: 'musician',
      event: { id: 'event-1', band_id: 'band-1', status: 'contracted', cancelled_at: new Date() },
    })
    const res = await DELETE(req('DELETE'), { params: params() })
    expect(res.status).toBe(403)
    expect(prisma.event.update).not.toHaveBeenCalled()
  })
})
