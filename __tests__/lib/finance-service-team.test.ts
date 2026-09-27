import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  CACHE_MUSICO_CATEGORY,
  computeEventFinance,
  computeTeamTotal,
  serializeFinance,
} from '@/lib/financas'

// ── Prisma falso em memória ──────────────────────────────────────────────────
// Modela só o que o finance-service usa, para testar comportamento (o que aparece no
// Financeiro) e não chamadas de mock.
type EM = {
  id: string
  event_id: string
  user_id: string | null
  instrument: string | null
  status: 'pending' | 'confirmed' | 'declined'
  cache_value: number | null
}
type Item = {
  id: string
  finance_id: string
  category: string
  label: string
  amount: number
  paid: boolean
  event_musician_id: string | null
  created_at: Date
}

const db = {
  users: {} as Record<string, string>,
  events: [] as { id: string; band_id: string; client_name: string; event_date: Date; value: number }[],
  finances: [] as { id: string; event_id: string; band_id: string }[],
  ems: [] as EM[],
  items: [] as Item[],
  seq: 0,
  transactions: 0,
}

function resetDb() {
  db.users = {}
  db.events = []
  db.finances = []
  db.ems = []
  db.items = []
  db.seq = 0
  db.transactions = 0
}

const nextId = (p: string) => `${p}-${++db.seq}`

function financeWithItems(f: { id: string; event_id: string; band_id: string }) {
  return {
    ...f,
    name: 'x', client: 'x', product: null, notes: null,
    event_date: new Date('2026-09-26'),
    expected_revenue: 30000,
    received_amount: 0,
    items: db.items.filter(i => i.finance_id === f.id).sort((a, b) => a.created_at.getTime() - b.created_at.getTime()),
    payments: [],
  }
}

vi.mock('@/lib/prisma', () => {
  const fake: any = {
    eventMusician: {
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const em = db.ems.find(e => e.id === where.id)
        if (!em) throw new Error('not found')
        return {
          ...em,
          user: em.user_id ? { name: db.users[em.user_id] } : null,
          event: { id: em.event_id },
        }
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return db.ems
          .filter(em => {
            if (where.user_id?.not === null && em.user_id === null) return false
            if (where.cache_value?.not === null && em.cache_value === null) return false
            const ev = db.events.find(e => e.id === em.event_id)!
            if (where.event?.band_id && ev.band_id !== where.event.band_id) return false
            if (where.event?.id && ev.id !== where.event.id) return false
            if (where.event?.finance?.isNot === null && !db.finances.some(f => f.event_id === ev.id)) return false
            if (where.finance_items?.none && db.items.some(i => i.event_musician_id === em.id)) return false
            return true
          })
          .map(em => ({ id: em.id }))
      }),
    },
    event: {
      findUniqueOrThrow: vi.fn(async ({ where }: any) => db.events.find(e => e.id === where.id)!),
    },
    eventFinance: {
      findUnique: vi.fn(async ({ where }: any) => {
        const f = db.finances.find(x => x.event_id === where.event_id)
        return f ? financeWithItems(f) : null
      }),
      create: vi.fn(async ({ data }: any) => {
        const f = { id: nextId('fin'), event_id: data.event_id, band_id: data.band_id }
        db.finances.push(f)
        for (const it of data.items?.createMany?.data ?? []) {
          db.items.push({ id: nextId('item'), finance_id: f.id, ...it, event_musician_id: null, created_at: new Date(Date.now() + db.seq) })
        }
        return financeWithItems(f)
      }),
    },
    eventFinanceItem: {
      findFirst: vi.fn(async ({ where }: any) => db.items.find(i => i.event_musician_id === where.event_musician_id) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const item = { id: nextId('item'), paid: false, ...data, created_at: new Date(Date.now() + db.seq) }
        db.items.push(item)
        return item
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const item = db.items.find(i => i.id === where.id)!
        Object.assign(item, data)
        return item
      }),
      delete: vi.fn(async ({ where }: any) => {
        db.items = db.items.filter(i => i.id !== where.id)
      }),
    },
    $executeRaw: vi.fn(async () => 0),
    // Transações executam em série: representa a exclusão mútua do pg_advisory_xact_lock.
    $transaction: vi.fn((fn: any) => {
      db.transactions++
      const run = queue.then(() => fn(fake))
      queue = run.then(() => undefined, () => undefined)
      return run
    }),
  }
  let queue: Promise<void> = Promise.resolve()
  return { prisma: fake }
})

// Importado depois do mock
import { syncMusicianCost, reconcileTeamCosts } from '@/lib/finance-service'

// ── Helpers de cenário ───────────────────────────────────────────────────────
const BAND = 'band-1'

function seedEvent(id = 'ev-mariah', band = BAND, withFinance = true) {
  db.events.push({ id, band_id: band, client_name: 'Mariah & Cesar', event_date: new Date('2026-09-26'), value: 30000 })
  if (withFinance) db.finances.push({ id: `fin-${id}`, event_id: id, band_id: band })
  return id
}

function seedMusician(p: {
  id: string
  event?: string
  instrument: string
  name?: string | null
  status?: EM['status']
  cache?: number | null
}) {
  const userId = p.name ? `user-${p.id}` : null
  if (userId) db.users[userId] = p.name!
  db.ems.push({
    id: p.id,
    event_id: p.event ?? 'ev-mariah',
    user_id: userId,
    instrument: p.instrument,
    status: p.status ?? 'pending',
    cache_value: p.cache === undefined ? null : p.cache,
  })
}

const linesOf = (emId: string) => db.items.filter(i => i.event_musician_id === emId)
const teamLines = (eventId = 'ev-mariah') =>
  db.items.filter(i => i.finance_id === `fin-${eventId}` && i.category === CACHE_MUSICO_CATEGORY)

beforeEach(() => {
  resetDb()
  vi.clearAllMocks()
})

// ── syncMusicianCost ─────────────────────────────────────────────────────────
describe('syncMusicianCost — a Formação define quem aparece em Equipe / Cachês', () => {
  it('CASO 1: Guitarra — Renanzinho Guita com cachê R$ 600 gera a linha "Guitarra — Renanzinho Guita" = 600', async () => {
    seedEvent()
    seedMusician({ id: 'em-guita', instrument: 'Guitarra', name: 'Renanzinho Guita', status: 'confirmed', cache: 600 })

    await syncMusicianCost('em-guita')

    const lines = linesOf('em-guita')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      category: CACHE_MUSICO_CATEGORY,
      label: 'Guitarra — Renanzinho Guita',
      amount: 600,
      paid: false,
    })
  })

  it.each(['pending', 'confirmed', 'declined'] as const)(
    'CASOS 2/3: músico com status "%s" aparece no Financeiro (confirmação não filtra)',
    async status => {
      seedEvent()
      seedMusician({ id: 'em-1', instrument: 'Baixo', name: 'Wandi Baixo', status, cache: 600 })

      await syncMusicianCost('em-1')

      expect(linesOf('em-1')).toHaveLength(1)
    }
  )

  it.each([
    ['Voz Feminina', 'Milena Cantora'],
    ['Voz Masculina', 'Edu Cantor'],
    ['Guitarra', 'Renanzinho Guita'],
    ['Baixo', 'Wandi Baixo'],
    ['Bateria', 'Denis Baterista'],
    ['Teclado', 'Paulinho Teclado'],
    ['Saxofone', 'Edmilson Saxofone'],
    ['Acordeom', 'Julio Sanfoneiro'],
    ['Equipe de Som', 'STUDIO 284 - XANDAO'],
    ['Time SB', 'Time SB'],
    ['Cerimônia', 'Cerimonialista'],
  ])('funciona para qualquer função: %s — %s', async (instrument, name) => {
    seedEvent()
    seedMusician({ id: 'em-x', instrument, name, cache: 500 })

    await syncMusicianCost('em-x')

    expect(linesOf('em-x')).toHaveLength(1)
    expect(linesOf('em-x')[0].label).toBe(`${instrument} — ${name}`)
    expect(linesOf('em-x')[0].amount).toBe(500)
  })

  it('CASO 5: Equipe de Som atribuída aparece com o cachê da Formação', async () => {
    seedEvent()
    seedMusician({ id: 'em-som', instrument: 'Equipe de Som', name: 'STUDIO 284 - XANDAO', cache: 10900 })

    await syncMusicianCost('em-som')

    expect(linesOf('em-som')[0]).toMatchObject({ label: 'Equipe de Som — STUDIO 284 - XANDAO', amount: 10900 })
  })

  it('CASO 4: vaga aberta (Teclado sem músico) NÃO gera linha, mesmo com cachê preenchido', async () => {
    seedEvent()
    seedMusician({ id: 'em-vaga', instrument: 'Teclado', name: null, cache: 500 })
    seedMusician({ id: 'em-vaga2', instrument: 'Teclado', name: null, cache: null })

    await syncMusicianCost('em-vaga')
    await syncMusicianCost('em-vaga2')

    expect(db.items.filter(i => i.category === CACHE_MUSICO_CATEGORY)).toHaveLength(0)
  })

  it('regra existente preservada: músico atribuído SEM cachê definido não gera linha', async () => {
    seedEvent()
    seedMusician({ id: 'em-time', instrument: 'Time SB', name: 'Time SB', status: 'confirmed', cache: null })

    await syncMusicianCost('em-time')

    expect(linesOf('em-time')).toHaveLength(0)
  })

  it('CASO 6: alterar o cachê na Formação atualiza a mesma linha (sem duplicar)', async () => {
    seedEvent()
    seedMusician({ id: 'em-1', instrument: 'Guitarra', name: 'Renanzinho Guita', cache: 600 })
    await syncMusicianCost('em-1')

    db.ems[0].cache_value = 750
    await syncMusicianCost('em-1')

    expect(linesOf('em-1')).toHaveLength(1)
    expect(linesOf('em-1')[0].amount).toBe(750)
  })

  it('reatribuir a vaga a outro músico atualiza o rótulo da linha existente', async () => {
    seedEvent()
    seedMusician({ id: 'em-1', instrument: 'Guitarra', name: 'Renanzinho Guita', cache: 600 })
    await syncMusicianCost('em-1')

    db.users['user-em-1'] = 'Edi Guita'
    await syncMusicianCost('em-1')

    expect(linesOf('em-1')).toHaveLength(1)
    expect(linesOf('em-1')[0].label).toBe('Guitarra — Edi Guita')
  })

  it('sincronizar duas vezes seguidas mantém uma única linha por atribuição', async () => {
    seedEvent()
    seedMusician({ id: 'em-1', instrument: 'Baixo', name: 'Wandi Baixo', cache: 600 })

    await Promise.all([syncMusicianCost('em-1'), syncMusicianCost('em-1')])
    await syncMusicianCost('em-1')

    expect(linesOf('em-1')).toHaveLength(1)
  })

  it('checagem + criação acontecem dentro de uma transação (proteção contra linha duplicada)', async () => {
    seedEvent()
    seedMusician({ id: 'em-1', instrument: 'Baixo', name: 'Wandi Baixo', cache: 600 })

    await syncMusicianCost('em-1')

    expect(db.transactions).toBeGreaterThan(0)
  })

  it('cachê limpo na Formação remove a linha ainda não paga (regra existente)', async () => {
    seedEvent()
    seedMusician({ id: 'em-1', instrument: 'Baixo', name: 'Wandi Baixo', cache: 600 })
    await syncMusicianCost('em-1')

    db.ems[0].cache_value = null
    await syncMusicianCost('em-1')

    expect(linesOf('em-1')).toHaveLength(0)
  })

  it('linha já paga é mantida com o valor quando o cachê da Formação é limpo', async () => {
    seedEvent()
    seedMusician({ id: 'em-1', instrument: 'Baixo', name: 'Wandi Baixo', cache: 600 })
    await syncMusicianCost('em-1')
    linesOf('em-1')[0].paid = true

    db.ems[0].cache_value = null
    await syncMusicianCost('em-1')

    expect(linesOf('em-1')[0].amount).toBe(600)
  })

  it('vaga que já tinha linha (não paga) e está sem músico tem a linha removida', async () => {
    seedEvent()
    seedMusician({ id: 'em-1', instrument: 'Teclado', name: null, cache: 500 })
    db.items.push({
      id: 'old', finance_id: 'fin-ev-mariah', category: CACHE_MUSICO_CATEGORY, label: 'Teclado',
      amount: 500, paid: false, event_musician_id: 'em-1', created_at: new Date(),
    })

    await syncMusicianCost('em-1')

    expect(linesOf('em-1')).toHaveLength(0)
  })

  it('vaga sem músico com linha já paga: não apaga (dinheiro já saiu)', async () => {
    seedEvent()
    seedMusician({ id: 'em-1', instrument: 'Teclado', name: null, cache: 500 })
    db.items.push({
      id: 'old', finance_id: 'fin-ev-mariah', category: CACHE_MUSICO_CATEGORY, label: 'Teclado',
      amount: 500, paid: true, event_musician_id: 'em-1', created_at: new Date(),
    })

    await syncMusicianCost('em-1')

    expect(linesOf('em-1')).toHaveLength(1)
  })
})

// ── reconcileTeamCosts ───────────────────────────────────────────────────────
describe('reconcileTeamCosts — cura atribuições que ficaram sem linha no Financeiro', () => {
  function seedMariah() {
    seedEvent()
    const team: [string, string, number, EM['status']][] = [
      ['em-som', 'Equipe de Som', 10900, 'pending'],
      ['em-edu', 'Voz Masculina', 700, 'confirmed'],
      ['em-mil', 'Voz Feminina', 800, 'confirmed'],
      ['em-den', 'Bateria', 600, 'pending'],
    ]
    const names: Record<string, string> = {
      'em-som': 'STUDIO 284 - XANDAO', 'em-edu': 'Edu Cantor', 'em-mil': 'Milena Cantora', 'em-den': 'Denis Baterista',
    }
    for (const [id, instrument, cache, status] of team) {
      seedMusician({ id, instrument, name: names[id], cache, status })
      db.items.push({
        id: `it-${id}`, finance_id: 'fin-ev-mariah', category: CACHE_MUSICO_CATEGORY,
        label: `${instrument} — ${names[id]}`, amount: cache, paid: false, event_musician_id: id, created_at: new Date(),
      })
    }
    // Denis: valor ajustado à mão no Financeiro (700) — não pode ser sobrescrito
    db.items.find(i => i.id === 'it-em-den')!.amount = 700

    seedMusician({ id: 'em-guita', instrument: 'Guitarra', name: 'Renanzinho Guita', status: 'confirmed', cache: 600 })
    seedMusician({ id: 'em-tec', instrument: 'Teclado', name: null, cache: null }) // vaga aberta
  }

  it('CASO 1 (real): cria só a linha que faltava — Guitarra — Renanzinho Guita = 600', async () => {
    seedMariah()

    const created = await reconcileTeamCosts({ bandId: BAND, eventId: 'ev-mariah' })

    expect(created).toBe(1)
    expect(linesOf('em-guita')).toHaveLength(1)
    expect(linesOf('em-guita')[0]).toMatchObject({ label: 'Guitarra — Renanzinho Guita', amount: 600 })
  })

  it('não cria linha para vaga aberta e não duplica os músicos que já estavam na lista', async () => {
    seedMariah()

    await reconcileTeamCosts({ bandId: BAND, eventId: 'ev-mariah' })

    expect(linesOf('em-tec')).toHaveLength(0)
    for (const id of ['em-som', 'em-edu', 'em-mil', 'em-den']) expect(linesOf(id)).toHaveLength(1)
    expect(teamLines()).toHaveLength(5)
  })

  it('não cria linha para atribuído sem cachê definido (ex.: Time SB) — só cura o que tem cachê', async () => {
    seedMariah()
    seedMusician({ id: 'em-timesb', instrument: 'Time SB', name: 'Time SB', status: 'confirmed', cache: null })

    const created = await reconcileTeamCosts({ bandId: BAND, eventId: 'ev-mariah' })

    expect(created).toBe(1) // apenas a Guitarra
    expect(linesOf('em-timesb')).toHaveLength(0)
  })

  it('não sobrescreve valores já existentes (Denis segue 700 mesmo com 600 na Formação)', async () => {
    seedMariah()

    await reconcileTeamCosts({ bandId: BAND, eventId: 'ev-mariah' })

    expect(linesOf('em-den')[0].amount).toBe(700)
  })

  it('é idempotente: a segunda execução não cria nada', async () => {
    seedMariah()

    await reconcileTeamCosts({ bandId: BAND, eventId: 'ev-mariah' })
    const second = await reconcileTeamCosts({ bandId: BAND, eventId: 'ev-mariah' })

    expect(second).toBe(0)
    expect(teamLines()).toHaveLength(5)
  })

  it('sem eventId, corrige a banda toda, mas só em eventos que já têm registro financeiro', async () => {
    seedMariah()
    seedEvent('ev-sem-fin', BAND, false)
    seedMusician({ id: 'em-orfao', event: 'ev-sem-fin', instrument: 'Baixo', name: 'Wandi Baixo', cache: 600 })

    const created = await reconcileTeamCosts({ bandId: BAND })

    expect(created).toBe(1) // só a Guitarra da Mariah
    expect(linesOf('em-orfao')).toHaveLength(0)
    expect(db.finances.some(f => f.event_id === 'ev-sem-fin')).toBe(false)
  })

  it('não mexe em eventos de outra banda', async () => {
    seedMariah()
    seedEvent('ev-outra', 'band-2')
    seedMusician({ id: 'em-outra', event: 'ev-outra', instrument: 'Baixo', name: 'Fulano', cache: 600 })

    await reconcileTeamCosts({ bandId: BAND })

    expect(linesOf('em-outra')).toHaveLength(0)
  })

  it('músico em duas funções no mesmo evento gera uma linha por atribuição (comportamento atual preservado)', async () => {
    seedEvent()
    seedMusician({ id: 'em-a', instrument: 'Guitarra', name: 'Renanzinho Guita', cache: 600 })
    seedMusician({ id: 'em-b', instrument: 'Baixo', name: 'Renanzinho Guita', cache: 400 })

    await reconcileTeamCosts({ bandId: BAND, eventId: 'ev-mariah' })

    expect(linesOf('em-a')).toHaveLength(1)
    expect(linesOf('em-b')).toHaveLength(1)
  })

  it('falha ao curar não derruba a tela: registra o erro e devolve 0', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.eventMusician.findMany).mockRejectedValueOnce(new Error('pool esgotado'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(reconcileTeamCosts({ bandId: BAND })).resolves.toBe(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Total da equipe ──────────────────────────────────────────────────────────
describe('CASO 8: Total da equipe e custos do evento', () => {
  it('inclui o cachê do músico que faltava (+ R$ 600) em Total da equipe, Custos e Lucro', async () => {
    seedEvent()
    const team: [string, string, string, number][] = [
      ['em-som', 'Equipe de Som', 'STUDIO 284 - XANDAO', 10900],
      ['em-edu', 'Voz Masculina', 'Edu Cantor', 700],
      ['em-mil', 'Voz Feminina', 'Milena Cantora', 800],
      ['em-den', 'Bateria', 'Denis Baterista', 700], // ajustado no Financeiro
      ['em-jul', 'Acordeom', 'Julio Sanfoneiro', 500],
      ['em-wan', 'Baixo', 'Wandi Baixo', 600],
    ]
    for (const [id, instrument, name, amount] of team) {
      seedMusician({ id, instrument, name, cache: amount })
      db.items.push({
        id: `it-${id}`, finance_id: 'fin-ev-mariah', category: CACHE_MUSICO_CATEGORY,
        label: `${instrument} — ${name}`, amount, paid: false, event_musician_id: id, created_at: new Date(),
      })
    }
    seedMusician({ id: 'em-guita', instrument: 'Guitarra', name: 'Renanzinho Guita', status: 'confirmed', cache: 600 })

    const load = async () => {
      const { prisma } = await import('@/lib/prisma')
      const f = await (prisma as any).eventFinance.findUnique({ where: { event_id: 'ev-mariah' } })
      return serializeFinance(f)
    }

    const before = await load()
    expect(computeTeamTotal(before.items)).toBe(14200)
    const costsBefore = computeEventFinance(before)

    await reconcileTeamCosts({ bandId: BAND, eventId: 'ev-mariah' })

    const after = await load()
    expect(computeTeamTotal(after.items)).toBe(14800)
    const costsAfter = computeEventFinance(after)
    expect(costsAfter.costTotal - costsBefore.costTotal).toBe(600)
    expect(costsBefore.profit - costsAfter.profit).toBe(600)
  })

  it('computeTeamTotal ignora outras categorias de custo', () => {
    const items = [
      { category: CACHE_MUSICO_CATEGORY, amount: 600 },
      { category: CACHE_MUSICO_CATEGORY, amount: 400.5 },
      { category: 'transporte', amount: 999 },
    ] as any
    expect(computeTeamTotal(items)).toBe(1000.5)
  })
})
