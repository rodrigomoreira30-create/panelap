import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/financas/[id]/items/route'
import { PATCH, DELETE } from '@/app/api/financas/[id]/items/[itemId]/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    eventFinance: { findUnique: vi.fn() },
    eventFinanceItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    eventPayment: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

const admin = { id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1', role: 'admin' }

function req(method: string, body?: unknown): Request {
  return new Request('http://localhost:3000/api/financas/finance-1/items', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const financeParams = Promise.resolve({ id: 'finance-1' })
const itemParams = Promise.resolve({ id: 'finance-1', itemId: 't2' })

const existingItem = {
  id: 't2', finance_id: 'finance-1', category: 'transporte', label: 'Carro 2 — Carlos',
  amount: { toString: () => '350' }, paid: false, percent_of_revenue: null,
  finance: { band_id: 'band-1', expected_revenue: { toString: () => '10000' } },
}

describe('Transporte detalhado — persistência via itens financeiros', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { getSessionUser } = await import('@/lib/auth/session')
    vi.mocked(getSessionUser).mockResolvedValue(admin as any)
  })

  it('POST cria um item independente na categoria transporte', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinance.findUnique).mockResolvedValueOnce({ id: 'finance-1', band_id: 'band-1' } as any)
    vi.mocked(prisma.eventFinanceItem.create).mockImplementationOnce((async ({ data }: any) => ({
      id: 'novo', ...data, amount: { toString: () => String(data.amount) },
    })) as any)

    const res = await POST(req('POST', { category: 'transporte', label: 'Carro 1 — João', amount: 300 }), { params: financeParams })

    expect(res.status).toBe(201)
    expect(prisma.eventFinanceItem.create).toHaveBeenCalledWith({
      data: { finance_id: 'finance-1', category: 'transporte', label: 'Carro 1 — João', amount: 300, paid: false },
    })
    expect((await res.json()).data.amount).toBe(300)
  })

  it('POST em financeiro de outra banda é recusado', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinance.findUnique).mockResolvedValueOnce({ id: 'finance-1', band_id: 'outra' } as any)

    const res = await POST(req('POST', { category: 'transporte', label: 'X', amount: 1 }), { params: financeParams })

    expect(res.status).toBe(404)
    expect(prisma.eventFinanceItem.create).not.toHaveBeenCalled()
  })

  it('músico não pode criar transporte', async () => {
    const { getSessionUser } = await import('@/lib/auth/session')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(getSessionUser).mockResolvedValueOnce({ ...admin, role: 'musician' } as any)

    const res = await POST(req('POST', { category: 'transporte', label: 'X', amount: 1 }), { params: financeParams })

    expect(res.status).toBe(403)
    expect(prisma.eventFinanceItem.create).not.toHaveBeenCalled()
  })

  it('PATCH paid altera só o status daquele item, sem tocar valor nem recebimentos', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinanceItem.findUnique).mockResolvedValueOnce(existingItem as any)
    vi.mocked(prisma.eventFinanceItem.update).mockImplementationOnce((async ({ data }: any) => ({
      ...existingItem, ...data, percent_of_revenue: null,
    })) as any)

    const res = await PATCH(req('PATCH', { paid: true }), { params: itemParams })

    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.eventFinanceItem.update).mock.calls[0][0] as any
    expect(call.where).toEqual({ id: 't2' })
    expect(call.data.paid).toBe(true)
    expect(call.data.amount).toBeUndefined()
    expect(prisma.eventPayment.create).not.toHaveBeenCalled()
    expect(prisma.eventPayment.update).not.toHaveBeenCalled()
  })

  it('PATCH label e amount atualizam nome e valor do transporte', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinanceItem.findUnique).mockResolvedValueOnce(existingItem as any)
    vi.mocked(prisma.eventFinanceItem.update).mockImplementationOnce((async ({ data }: any) => ({
      ...existingItem, ...data, amount: { toString: () => String(data.amount) }, percent_of_revenue: null,
    })) as any)

    await PATCH(req('PATCH', { label: 'Van — Carlos', amount: 400 }), { params: itemParams })

    const call = vi.mocked(prisma.eventFinanceItem.update).mock.calls[0][0] as any
    expect(call.data.label).toBe('Van — Carlos')
    expect(call.data.amount).toBe(400)
  })

  it('DELETE remove apenas o transporte indicado', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinanceItem.findUnique).mockResolvedValueOnce(existingItem as any)

    const res = await DELETE(req('DELETE'), { params: itemParams })

    expect(res.status).toBe(200)
    expect(prisma.eventFinanceItem.delete).toHaveBeenCalledWith({ where: { id: 't2' } })
  })

  it('DELETE de item de outro financeiro é recusado', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinanceItem.findUnique).mockResolvedValueOnce({ ...existingItem, finance_id: 'outro' } as any)

    const res = await DELETE(req('DELETE'), { params: itemParams })

    expect(res.status).toBe(404)
    expect(prisma.eventFinanceItem.delete).not.toHaveBeenCalled()
  })
})
