import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Matriz de autorização das APIs do painel: sem sessão → 401; perfil fora do painel
// (musician, ou papel desconhecido) → 403 antes de qualquer leitura/escrita de dados.

const state = vi.hoisted(() => ({
  supabaseUser: null as null | { id: string },
  dbUser: null as null | { id: string; band_id: string; supabase_id: string; role: string },
  fns: new Map<string, ReturnType<typeof import('vitest').vi.fn>>(),
}))

vi.mock('@/lib/prisma', async () => {
  const { vi } = await import('vitest')
  const fn = (key: string) => {
    if (!state.fns.has(key)) state.fns.set(key, vi.fn())
    return state.fns.get(key)!
  }
  const model = (name: string) => new Proxy({}, { get: (_t, method) => fn(`${name}.${String(method)}`) })
  return { prisma: new Proxy({}, { get: (_t, name) => model(String(name)) }) }
})

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(async () => state.dbUser),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.supabaseUser } }) },
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn() }, auth: { admin: {} } })),
}))

vi.mock('@/lib/finance-service', () => ({
  reconcileTeamCosts: vi.fn().mockResolvedValue(0),
  getOrCreateEventFinance: vi.fn(),
}))

function prismaFn(key: string) {
  if (!state.fns.has(key)) state.fns.set(key, vi.fn())
  return state.fns.get(key)!
}

/** Chamadas ao banco além da leitura do próprio usuário (feita pelos helpers de sessão). */
function dataCalls(): string[] {
  return [...state.fns.entries()]
    .filter(([key, f]) => key !== 'user.findUnique' && f.mock.calls.length > 0)
    .map(([key]) => key)
}

function loginAs(role: string | null, band_id = 'band-1') {
  if (role === null) {
    state.supabaseUser = null
    state.dbUser = null
    return
  }
  state.supabaseUser = { id: 'sup-x' }
  state.dbUser = { id: 'user-x', band_id, supabase_id: 'sup-x', role }
  prismaFn('user.findUnique').mockImplementation(async () => ({
    ...state.dbUser,
    band: { id: band_id, slug: 'sapo', pipeline_stages: [] },
  }))
}

const req = (url: string, method = 'GET', body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const p = <T extends Record<string, string>>(v: T) => ({ params: Promise.resolve(v) })

type Call = [string, () => Promise<Response>]

const PROTECTED: Call[] = [
  // Finanças
  ['GET /api/financas', async () => (await import('@/app/api/financas/route')).GET(req('/api/financas'))],
  ['POST /api/financas', async () => (await import('@/app/api/financas/route')).POST(req('/api/financas', 'POST', { event_id: 'e1' }))],
  ['PATCH /api/financas/[id]', async () => (await import('@/app/api/financas/[id]/route')).PATCH(req('/x', 'PATCH', {}), p({ id: 'f1' }))],
  ['DELETE /api/financas/[id]', async () => (await import('@/app/api/financas/[id]/route')).DELETE(req('/x', 'DELETE'), p({ id: 'f1' }))],
  ['POST /api/financas/[id]/items', async () => (await import('@/app/api/financas/[id]/items/route')).POST(req('/x', 'POST', {}), p({ id: 'f1' }))],
  ['PATCH /api/financas/[id]/items/[itemId]', async () => (await import('@/app/api/financas/[id]/items/[itemId]/route')).PATCH(req('/x', 'PATCH', {}), p({ id: 'f1', itemId: 'i1' }))],
  ['DELETE /api/financas/[id]/items/[itemId]', async () => (await import('@/app/api/financas/[id]/items/[itemId]/route')).DELETE(req('/x', 'DELETE'), p({ id: 'f1', itemId: 'i1' }))],
  ['POST /api/financas/[id]/payments', async () => (await import('@/app/api/financas/[id]/payments/route')).POST(req('/x', 'POST', {}), p({ id: 'f1' }))],
  ['PATCH /api/financas/[id]/payments/[paymentId]', async () => (await import('@/app/api/financas/[id]/payments/[paymentId]/route')).PATCH(req('/x', 'PATCH', {}), p({ id: 'f1', paymentId: 'p1' }))],
  ['DELETE /api/financas/[id]/payments/[paymentId]', async () => (await import('@/app/api/financas/[id]/payments/[paymentId]/route')).DELETE(req('/x', 'DELETE'), p({ id: 'f1', paymentId: 'p1' }))],
  ['GET /api/events/[id]/finance', async () => (await import('@/app/api/events/[id]/finance/route')).GET(req('/x'), p({ id: 'e1' }))],
  ['GET /api/dashboard', async () => (await import('@/app/api/dashboard/route')).GET(req('/api/dashboard?bandSlug=sapo'))],
  // Contratos
  ['GET /api/contracts', async () => (await import('@/app/api/contracts/route')).GET(req('/api/contracts'))],
  ['POST /api/contracts', async () => (await import('@/app/api/contracts/route')).POST(req('/api/contracts', 'POST', {}))],
  ['GET /api/contracts/[id]', async () => (await import('@/app/api/contracts/[id]/route')).GET(req('/x'), p({ id: 'c1' }))],
  ['PATCH /api/contracts/[id]', async () => (await import('@/app/api/contracts/[id]/route')).PATCH(req('/x', 'PATCH', { status: 'signed' }), p({ id: 'c1' }))],
  ['POST /api/contracts/[id]/approve', async () => (await import('@/app/api/contracts/[id]/approve/route')).POST(req('/x', 'POST'), p({ id: 'c1' }))],
  ['GET /api/contract-templates', async () => (await import('@/app/api/contract-templates/route')).GET(req('/x'))],
  ['GET /api/contract-templates/[id]', async () => (await import('@/app/api/contract-templates/[id]/route')).GET(req('/x'), p({ id: 't1' }))],
  // Documentos
  ['GET /api/documents', async () => (await import('@/app/api/documents/route')).GET(req('/api/documents'))],
  ['POST /api/documents', async () => (await import('@/app/api/documents/route')).POST(req('/api/documents', 'POST', {}))],
  ['GET /api/documents/[id]/download', async () => (await import('@/app/api/documents/[id]/download/route')).GET(req('/x'), p({ id: 'd1' }))],
  ['DELETE /api/documents/[id]', async () => (await import('@/app/api/documents/[id]/route')).DELETE(req('/x', 'DELETE'), p({ id: 'd1' }))],
  ['POST /api/documents/upload-url', async () => (await import('@/app/api/documents/upload-url/route')).POST(req('/x', 'POST', {}))],
  ['GET /api/events/[id]/documents', async () => (await import('@/app/api/events/[id]/documents/route')).GET(req('/x'), p({ id: 'e1' }))],
  ['GET /api/leads/[id]/documents', async () => (await import('@/app/api/leads/[id]/documents/route')).GET(req('/x'), p({ id: 'l1' }))],
  // Eventos, agenda, comercial e configurações
  ['GET /api/events', async () => (await import('@/app/api/events/route')).GET(req('/api/events'))],
  ['GET /api/events/[id]', async () => (await import('@/app/api/events/[id]/route')).GET(req('/x'), p({ id: 'e1' }))],
  ['GET /api/agenda', async () => (await import('@/app/api/agenda/route')).GET(req('/api/agenda'))],
  ['GET /api/leads', async () => (await import('@/app/api/leads/route')).GET(req('/api/leads'))],
  ['GET /api/leads/[id]', async () => (await import('@/app/api/leads/[id]/route')).GET(req('/x'), p({ id: 'l1' }))],
  ['POST /api/leads/[id]/messages', async () => (await import('@/app/api/leads/[id]/messages/route')).POST(req('/x', 'POST', { content: 'oi' }), p({ id: 'l1' }))],
  ['GET /api/leads/[id]/attractions', async () => (await import('@/app/api/leads/[id]/attractions/route')).GET(req('/x'), p({ id: 'l1' }))],
  ['GET /api/attractions', async () => (await import('@/app/api/attractions/route')).GET()],
  ['GET /api/settings/pipeline', async () => (await import('@/app/api/settings/pipeline/route')).GET()],
  ['GET /api/settings/sources', async () => (await import('@/app/api/settings/sources/route')).GET()],
  ['GET /api/billing/subscription', async () => (await import('@/app/api/billing/subscription/route')).GET()],
]

beforeEach(() => {
  state.fns.forEach(f => f.mockReset())
  loginAs(null)
})

describe('APIs do painel — sem autenticação', () => {
  it.each(PROTECTED)('%s → 401', async (_name, call) => {
    const res = await call()
    expect(res.status).toBe(401)
    expect(dataCalls()).toEqual([])
  })
})

describe('APIs do painel — músico', () => {
  it.each(PROTECTED)('%s → 403 sem tocar nos dados', async (_name, call) => {
    loginAs('musician')
    const res = await call()
    expect(res.status).toBe(403)
    expect(dataCalls()).toEqual([])
  })
})

describe('APIs do painel — perfil desconhecido (ex.: fornecedor)', () => {
  it.each(PROTECTED.filter(([name]) => /documents|contracts|financas|finance/.test(name)))(
    '%s → 403',
    async (_name, call) => {
      loginAs('fornecedor')
      const res = await call()
      expect(res.status).toBe(403)
      expect(dataCalls()).toEqual([])
    }
  )
})

describe('Acessos legítimos preservados', () => {
  it('administrador consulta o Financeiro Geral (200)', async () => {
    loginAs('admin')
    prismaFn('eventFinance.findMany').mockResolvedValue([])
    const { GET } = await import('@/app/api/financas/route')

    const res = await GET(req('/api/financas?month=10&year=2026'))

    expect(res.status).toBe(200)
    expect(prismaFn('eventFinance.findMany')).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ band_id: 'band-1' }) })
    )
  })

  it.each(['commercial', 'producer', 'singer'])('perfil %s mantém o acesso que já tinha pela interface', async role => {
    loginAs(role)
    prismaFn('eventFinance.findMany').mockResolvedValue([])
    const { GET } = await import('@/app/api/financas/route')

    expect((await GET(req('/api/financas'))).status).toBe(200)
  })

  it('administrador consulta e edita eventos', async () => {
    loginAs('admin')
    const event = { id: 'e1', band_id: 'band-1', client_name: 'Cliente' }
    prismaFn('event.findMany').mockResolvedValue([event])
    prismaFn('event.findFirst').mockResolvedValue(event)
    prismaFn('event.update').mockResolvedValue({ ...event, venue_name: 'Novo Local' })
    const list = await import('@/app/api/events/route')
    const one = await import('@/app/api/events/[id]/route')

    expect((await list.GET(req('/api/events'))).status).toBe(200)
    expect((await one.GET(req('/x'), p({ id: 'e1' }))).status).toBe(200)
    const patched = await one.PATCH(req('/x', 'PATCH', { venue_name: 'Novo Local' }), p({ id: 'e1' }))
    expect(patched.status).toBe(200)
    expect(prismaFn('event.update')).toHaveBeenCalled()
  })

  it('administrador cria evento ao fechar um lead (fluxo do Comercial)', async () => {
    loginAs('admin')
    const lead = {
      id: 'l1', band_id: 'band-1', client_name: 'Cliente', status: 'negotiation',
      event_type: 'wedding', event_date: new Date('2026-12-10'), venue_name: 'Espaço', budget: 1000,
    }
    prismaFn('lead.findUnique').mockResolvedValue(lead)
    prismaFn('lead.update').mockResolvedValue({ ...lead, status: 'closed' })
    prismaFn('event.findUnique').mockResolvedValue(null)
    prismaFn('event.create').mockResolvedValue({ id: 'e-novo' })
    prismaFn('leadAttraction.findMany').mockResolvedValue([])
    const { PATCH } = await import('@/app/api/leads/[id]/route')

    const res = await PATCH(req('/x', 'PATCH', { status: 'closed' }), p({ id: 'l1' }))

    expect(res.status).toBe(200)
  })
})

describe('Isolamento entre bandas', () => {
  it('admin de outra banda não vê o financeiro do evento (404)', async () => {
    loginAs('admin', 'band-2')
    prismaFn('event.findFirst').mockResolvedValue(null)
    const { GET } = await import('@/app/api/events/[id]/finance/route')

    const res = await GET(req('/x'), p({ id: 'e1' }))

    expect(res.status).toBe(404)
    expect(prismaFn('event.findFirst')).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ band_id: 'band-2' }) })
    )
  })

  it('admin de outra banda não baixa documento (404)', async () => {
    loginAs('admin', 'band-2')
    prismaFn('document.findUnique').mockResolvedValue(null)
    const { GET } = await import('@/app/api/documents/[id]/download/route')

    const res = await GET(req('/x'), p({ id: 'd1' }))

    expect(res.status).toBe(404)
    expect(prismaFn('document.findUnique')).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ band_id: 'band-2' }) })
    )
  })

  it('dashboard recusa slug de outra banda (403)', async () => {
    loginAs('admin', 'band-2')
    const { GET } = await import('@/app/api/dashboard/route')

    const res = await GET(req('/api/dashboard?bandSlug=outra-banda'))

    expect(res.status).toBe(403)
  })
})

describe('Músico continua com agenda e cachê individuais (sem sessão do painel)', () => {
  const musicianSchedule = {
    name: 'André',
    event_musicians: [{
      id: 'em1', status: 'confirmed', cache_value: 350, instrument: 'Baixo',
      event: {
        client_name: 'Casamento Ana', event_type: 'wedding', event_date: new Date('2099-05-10T12:00:00Z'),
        event_time: '20:00', venue_name: 'Espaço', venue_address: null, notes: null,
      },
    }],
  }

  it('agenda individual mostra os eventos e o próprio cachê', async () => {
    prismaFn('user.findUnique').mockResolvedValue(musicianSchedule)
    const { default: Page } = await import('@/app/musico/[token]/page')

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ token: 'tok' }) }))

    expect(html).toContain('Casamento Ana')
    expect(html).toContain('Cachê: R$')
    expect(prismaFn('user.findUnique')).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schedule_token: 'tok' } })
    )
  })

  it('exportação da agenda (.ics) continua disponível', async () => {
    prismaFn('user.findUnique').mockResolvedValue(musicianSchedule)
    const { GET } = await import('@/app/api/ics/[token]/route')

    const res = await GET(req('/api/ics/tok'), p({ token: 'tok' }))

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('BEGIN:VCALENDAR')
  })
})

describe('Webhook do ZapSign removido', () => {
  it('a rota não existe mais no projeto (Next responde 404)', async () => {
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    expect(existsSync(resolve(__dirname, '../../app/api/webhooks/zapsign'))).toBe(false)
    expect(existsSync(resolve(__dirname, '../../lib/zapsign'))).toBe(false)
  })
})
