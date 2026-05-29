import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET as GET_AGENDA } from '@/app/api/agenda/route'
import { POST, GET as GET_CONFIRM } from '@/app/api/musicians/[id]/confirm/route'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ id: 'user-1', band_id: 'band-1', supabase_id: 'sup-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findMany: vi.fn() },
    eventMusician: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

const mockMusicianParams = Promise.resolve({ id: 'em-1' })

// ── Test 1: GET /api/agenda — returns calendar events for current month ──────────
describe('GET /api/agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns calendar events for the current month', async () => {
    const { prisma } = await import('@/lib/prisma')

    const mockEvents = [
      {
        id: 'event-1',
        band_id: 'band-1',
        client_name: 'Test Client',
        venue_name: 'Test Venue',
        status: 'contracted',
        event_type: 'show',
        event_date: new Date('2026-05-15'),
        event_musicians: [
          { user: { id: 'user-2', name: 'Musician One' } },
        ],
      },
    ]
    vi.mocked(prisma.event.findMany).mockResolvedValueOnce(mockEvents as any)

    const request = makeRequest('GET', 'http://localhost:3000/api/agenda')
    const response = await GET_AGENDA(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe('event-1')
    expect(json.data[0].title).toBe('Test Client — Test Venue')
    expect(json.data[0].resource.musicians).toContain('Musician One')
    expect(vi.mocked(prisma.event.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ band_id: 'band-1' }),
      })
    )
  })
})

// ── Test 2: GET /api/agenda — filters by year/month query params ─────────────────
describe('GET /api/agenda — year/month filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters events by year and month query params', async () => {
    const { prisma } = await import('@/lib/prisma')

    const mockEvents = [
      {
        id: 'event-2',
        band_id: 'band-1',
        client_name: 'August Client',
        venue_name: 'August Venue',
        status: 'contracted',
        event_type: 'show',
        event_date: new Date('2026-08-10'),
        event_musicians: [],
      },
    ]
    vi.mocked(prisma.event.findMany).mockResolvedValueOnce(mockEvents as any)

    const request = makeRequest('GET', 'http://localhost:3000/api/agenda?year=2026&month=8')
    const response = await GET_AGENDA(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe('event-2')
    expect(vi.mocked(prisma.event.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          band_id: 'band-1',
          event_date: {
            gte: new Date(2026, 7, 1),
            lte: new Date(2026, 8, 0, 23, 59, 59),
          },
        }),
      })
    )
  })
})

// ── Test 3: POST /api/musicians/[id]/confirm — confirms musician presence ────────
describe('POST /api/musicians/[id]/confirm — confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirms musician presence and returns updated record', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'em-1',
      event_id: 'event-1',
      user_id: 'user-2',
      status: 'pending',
      confirmed_at: null,
    } as any)

    vi.mocked(prisma.eventMusician.update).mockResolvedValueOnce({
      id: 'em-1',
      event_id: 'event-1',
      user_id: 'user-2',
      status: 'confirmed',
      confirmed_at: new Date(),
    } as any)

    const request = makeRequest('POST', 'http://localhost:3000/api/musicians/em-1/confirm', {
      action: 'confirm',
    })
    const response = await POST(request, { params: mockMusicianParams })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.status).toBe('confirmed')
    expect(vi.mocked(prisma.eventMusician.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'em-1' },
        data: expect.objectContaining({ status: 'confirmed' }),
      })
    )
  })
})

// ── Test 4: POST /api/musicians/[id]/confirm — declines musician presence ────────
describe('POST /api/musicians/[id]/confirm — decline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('declines musician presence and returns updated record', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.eventMusician.findUnique).mockResolvedValueOnce({
      id: 'em-1',
      event_id: 'event-1',
      user_id: 'user-2',
      status: 'pending',
      confirmed_at: null,
    } as any)

    vi.mocked(prisma.eventMusician.update).mockResolvedValueOnce({
      id: 'em-1',
      event_id: 'event-1',
      user_id: 'user-2',
      status: 'declined',
      confirmed_at: null,
    } as any)

    const request = makeRequest('POST', 'http://localhost:3000/api/musicians/em-1/confirm', {
      action: 'decline',
    })
    const response = await POST(request, { params: mockMusicianParams })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.status).toBe('declined')
    expect(vi.mocked(prisma.eventMusician.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'em-1' },
        data: expect.objectContaining({ status: 'declined' }),
      })
    )
  })
})

// ── Test 5: POST /api/musicians/[id]/confirm — returns 422 with invalid action ───
describe('POST /api/musicians/[id]/confirm — invalid action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 422 when action is invalid', async () => {
    const request = makeRequest('POST', 'http://localhost:3000/api/musicians/em-1/confirm', {
      action: 'maybe',
    })
    const response = await POST(request, { params: mockMusicianParams })

    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.error).toBeDefined()
  })
})
