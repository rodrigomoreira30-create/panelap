import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/financas/[id]/payments/route'
import { PATCH, DELETE } from '@/app/api/financas/[id]/payments/[paymentId]/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    eventFinance: { findUnique: vi.fn() },
    eventPayment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

function makeRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const collectionParams = Promise.resolve({ id: 'finance-1' })
const itemParams = Promise.resolve({ id: 'finance-1', paymentId: 'payment-1' })

describe('POST /api/financas/[id]/payments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita valor zero ou negativo', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinance.findUnique).mockResolvedValueOnce({ id: 'finance-1', band_id: 'band-1' } as any)

    const response = await POST(
      makeRequest('http://localhost/api/financas/finance-1/payments', 'POST', {
        payment_date: '2026-09-05', amount: 0, payment_method: 'PIX',
      }),
      { params: collectionParams }
    )
    expect(response.status).toBe(422)
  })

  it('rejeita forma de pagamento inválida', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinance.findUnique).mockResolvedValueOnce({ id: 'finance-1', band_id: 'band-1' } as any)

    const response = await POST(
      makeRequest('http://localhost/api/financas/finance-1/payments', 'POST', {
        payment_date: '2026-09-05', amount: 100, payment_method: 'Aleatorio',
      }),
      { params: collectionParams }
    )
    expect(response.status).toBe(422)
  })

  it('retorna 404 quando o financeiro não pertence à banda do usuário', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinance.findUnique).mockResolvedValueOnce({ id: 'finance-1', band_id: 'outra-banda' } as any)

    const response = await POST(
      makeRequest('http://localhost/api/financas/finance-1/payments', 'POST', {
        payment_date: '2026-09-05', amount: 100, payment_method: 'PIX',
      }),
      { params: collectionParams }
    )
    expect(response.status).toBe(404)
  })

  it('cria o recebimento com os dados informados', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventFinance.findUnique).mockResolvedValueOnce({ id: 'finance-1', band_id: 'band-1' } as any)
    vi.mocked(prisma.eventPayment.create).mockResolvedValueOnce({
      id: 'payment-1',
      finance_id: 'finance-1',
      payment_date: new Date('2026-09-05'),
      amount: { toString: () => '5000' },
      payment_method: 'PIX',
      notes: 'Entrada',
    } as any)

    const response = await POST(
      makeRequest('http://localhost/api/financas/finance-1/payments', 'POST', {
        payment_date: '2026-09-05', amount: 5000, payment_method: 'PIX', notes: 'Entrada',
      }),
      { params: collectionParams }
    )
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.data.amount).toBe(5000)
    expect(json.data.payment_method).toBe('PIX')
  })
})

describe('PATCH /api/financas/[id]/payments/[paymentId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('edita valor, data, forma de pagamento e observação', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventPayment.findUnique).mockResolvedValueOnce({
      id: 'payment-1',
      finance_id: 'finance-1',
      finance: { band_id: 'band-1' },
    } as any)
    vi.mocked(prisma.eventPayment.update).mockResolvedValueOnce({
      id: 'payment-1',
      finance_id: 'finance-1',
      payment_date: new Date('2026-09-10'),
      amount: { toString: () => '3000' },
      payment_method: 'Transferência',
      notes: '2º pagamento',
    } as any)

    const response = await PATCH(
      makeRequest('http://localhost/api/financas/finance-1/payments/payment-1', 'PATCH', {
        amount: 3000, payment_method: 'Transferência', notes: '2º pagamento',
      }),
      { params: itemParams }
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.amount).toBe(3000)
    expect(json.data.payment_method).toBe('Transferência')
  })

  it('retorna 404 quando o recebimento não pertence à banda do usuário', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventPayment.findUnique).mockResolvedValueOnce({
      id: 'payment-1',
      finance_id: 'finance-1',
      finance: { band_id: 'outra-banda' },
    } as any)

    const response = await PATCH(
      makeRequest('http://localhost/api/financas/finance-1/payments/payment-1', 'PATCH', { amount: 100 }),
      { params: itemParams }
    )
    expect(response.status).toBe(404)
  })
})

describe('DELETE /api/financas/[id]/payments/[paymentId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exclui o recebimento após validar posse', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventPayment.findUnique).mockResolvedValueOnce({
      id: 'payment-1',
      finance_id: 'finance-1',
      finance: { band_id: 'band-1' },
    } as any)
    vi.mocked(prisma.eventPayment.delete).mockResolvedValueOnce({} as any)

    const response = await DELETE(
      makeRequest('http://localhost/api/financas/finance-1/payments/payment-1', 'DELETE'),
      { params: itemParams }
    )
    expect(response.status).toBe(200)
    expect(prisma.eventPayment.delete).toHaveBeenCalledWith({ where: { id: 'payment-1' } })
  })
})
