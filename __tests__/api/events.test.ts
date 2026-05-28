import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/events/route'
import { GET as GET_ONE, PATCH } from '@/app/api/events/[id]/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

function makeRequest(method: string, url = 'http://localhost:3000/api/events', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const mockParams = Promise.resolve({ id: 'event-1' })

// ── Test 1: GET /api/events — returns events for band ─────────────────────────
describe('GET /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns events for the authenticated band', async () => {
    const { prisma } = await import('@/lib/prisma')

    const mockEvents = [
      {
        id: 'event-1',
        band_id: 'band-1',
        client_name: 'Test Client',
        status: 'contracted',
        event_date: new Date('2026-08-15'),
        checklists: [],
        event_musicians: [],
      },
    ]
    vi.mocked(prisma.event.findMany).mockResolvedValueOnce(mockEvents as any)

    const request = makeRequest('GET')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveLength(1)
    expect(vi.mocked(prisma.event.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ band_id: 'band-1' }),
      })
    )
  })
})

// ── Test 2: GET /api/events — filters by status query param ──────────────────
describe('GET /api/events — status filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters events by status when valid status is provided', async () => {
    const { prisma } = await import('@/lib/prisma')

    const mockEvents = [
      {
        id: 'event-2',
        band_id: 'band-1',
        client_name: 'Another Client',
        status: 'done',
        event_date: new Date('2026-06-01'),
        checklists: [],
        event_musicians: [],
      },
    ]
    vi.mocked(prisma.event.findMany).mockResolvedValueOnce(mockEvents as any)

    const request = makeRequest('GET', 'http://localhost:3000/api/events?status=done')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveLength(1)
    expect(vi.mocked(prisma.event.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ band_id: 'band-1', status: 'done' }),
      })
    )
  })
})

// ── Test 3: GET /api/events/[id] — returns single event with relations ────────
describe('GET /api/events/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a single event with relations', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getSessionUser } = await import('@/lib/auth/session')

    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' })

    const mockEvent = {
      id: 'event-1',
      band_id: 'band-1',
      client_name: 'Test Client',
      status: 'contracted',
      event_date: new Date('2026-08-15'),
      lead: { id: 'lead-1', phone: '11999999999' },
      checklists: [{ id: 'checklist-1', items: [] }],
      event_musicians: [{ id: 'em-1', user: { id: 'user-2', name: 'Musician', avatar_url: null } }],
      documents: [],
    }
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce(mockEvent as any)

    const request = makeRequest('GET', 'http://localhost:3000/api/events/event-1')
    const response = await GET_ONE(request, { params: mockParams })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.id).toBe('event-1')
    expect(json.data.lead).toBeDefined()
    expect(json.data.checklists).toBeDefined()
    expect(vi.mocked(prisma.event.findFirst)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-1', band_id: 'band-1' },
      })
    )
  })
})

// ── Test 4: GET /api/events/[id] — returns 404 when event not found ───────────
describe('GET /api/events/[id] — not found', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when event does not belong to band', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getSessionUser } = await import('@/lib/auth/session')

    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' })
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce(null)

    const request = makeRequest('GET', 'http://localhost:3000/api/events/nonexistent')
    const response = await GET_ONE(request, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error).toBeDefined()
  })
})

// ── Test 5: PATCH /api/events/[id] — updates event (role: admin/producer) ────
describe('PATCH /api/events/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates event when user has admin role', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getSessionUser } = await import('@/lib/auth/session')

    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' })
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)

    const existingEvent = {
      id: 'event-1',
      band_id: 'band-1',
      status: 'contracted',
    }
    vi.mocked(prisma.event.findFirst).mockResolvedValueOnce(existingEvent as any)

    const updatedEvent = {
      id: 'event-1',
      band_id: 'band-1',
      status: 'active',
      notes: 'Updated notes',
    }
    vi.mocked(prisma.event.update).mockResolvedValueOnce(updatedEvent as any)

    const request = makeRequest('PATCH', 'http://localhost:3000/api/events/event-1', {
      status: 'active',
      notes: 'Updated notes',
    })
    const response = await PATCH(request, { params: mockParams })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.status).toBe('active')
    expect(vi.mocked(prisma.event.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-1' },
        data: expect.objectContaining({ status: 'active', notes: 'Updated notes' }),
      })
    )
  })
})
