import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PATCH } from '@/app/api/checklists/[id]/items/route'
import { POST, DELETE } from '@/app/api/event-musicians/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    checklist: { findUnique: vi.fn() },
    checklistItem: { update: vi.fn() },
    event: { findFirst: vi.fn() },
    eventMusician: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const mockChecklistParams = Promise.resolve({ id: 'checklist-1' })

// ── Test 1: PATCH /api/checklists/[id]/items — toggles item done (admin role) ──
describe('PATCH /api/checklists/[id]/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggles item done state when user is admin', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.checklist.findUnique).mockResolvedValueOnce({
      id: 'checklist-1',
      event: { band_id: 'band-1' },
    } as any)
    vi.mocked(prisma.checklistItem.update).mockResolvedValueOnce({
      id: 'item-cjld2cyuq0000t3rmniod1foy',
      checklist_id: 'checklist-1',
      description: 'Setup stage',
      done: true,
      due_date: null,
    } as any)

    const request = makeRequest('PATCH', 'http://localhost:3000/api/checklists/checklist-1/items', {
      itemId: 'cjld2cyuq0000t3rmniod1foy',
      done: true,
    })
    const response = await PATCH(request, { params: mockChecklistParams })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.done).toBe(true)
    expect(vi.mocked(prisma.checklistItem.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { done: true },
      })
    )
  })
})

// ── Test 2: PATCH /api/checklists/[id]/items — returns 403 for non-admin ────────
describe('PATCH /api/checklists/[id]/items — 403 for non-admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when user role is musician (not admin/producer)', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'musician' } as any)

    const request = makeRequest('PATCH', 'http://localhost:3000/api/checklists/checklist-1/items', {
      itemId: 'cjld2cyuq0000t3rmniod1foy',
      done: true,
    })
    const response = await PATCH(request, { params: mockChecklistParams })

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error).toBe('Forbidden')
  })
})

// ── Test 3: POST /api/event-musicians — adds musician to event ──────────────────
describe('POST /api/event-musicians', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds a musician to an event', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce({ id: 'event-1', band_id: 'band-1' } as any)
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 'user-2', band_id: 'band-1' } as any)
    vi.mocked(prisma.eventMusician.upsert).mockResolvedValueOnce({
      id: 'em-1',
      event_id: 'event-1',
      user_id: 'user-2',
      instrument: 'guitar',
      status: 'pending',
      confirmed_at: null,
      user: { id: 'user-2', name: 'John', avatar_url: null },
    } as any)

    const request = makeRequest('POST', 'http://localhost:3000/api/event-musicians', {
      event_id: 'cjld2cyuq0000t3rmniod1foy',
      user_id: 'cjld2cjuq0000t3rmniod1foy',
      instrument: 'guitar',
    })
    const response = await POST(request)

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.data).toBeDefined()
    expect(json.data.instrument).toBe('guitar')
  })
})

// ── Test 4: POST /api/event-musicians — returns 404 when event not found ────────
describe('POST /api/event-musicians — event not found', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when event does not belong to band', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce(null)

    const request = makeRequest('POST', 'http://localhost:3000/api/event-musicians', {
      event_id: 'cjld2cyuq0000t3rmniod1foy',
      user_id: 'cjld2cjuq0000t3rmniod1foy',
    })
    const response = await POST(request)

    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error).toBe('Event not found')
  })
})

// ── Test 5: DELETE /api/event-musicians — removes musician from event ───────────
describe('DELETE /api/event-musicians', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes a musician from an event', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'producer' } as any)
    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'em-1',
      event_id: 'event-1',
      user_id: 'user-2',
      event: { band_id: 'band-1' },
    } as any)
    vi.mocked(prisma.eventMusician.delete).mockResolvedValueOnce({ id: 'em-1' } as any)

    const request = makeRequest('DELETE', 'http://localhost:3000/api/event-musicians?id=em-1')
    const response = await DELETE(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.deleted).toBe(true)
    expect(vi.mocked(prisma.eventMusician.delete)).toHaveBeenCalledWith({ where: { id: 'em-1' } })
  })
})
