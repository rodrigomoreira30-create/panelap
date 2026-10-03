import { describe, it, expect } from 'vitest'
import {
  categorizeInstrument,
  buildTeamMatrixRows,
  TEAM_CATEGORY_ORDER,
  TEAM_CATEGORY_LABELS,
} from '@/lib/financas-team-matrix'
import type { EventFinanceData, FinanceItemData } from '@/lib/financas'

// ── Helpers de cenário ───────────────────────────────────────────────────────
function item(over: Partial<FinanceItemData> & { event_musician?: { user_id: string; instrument: string | null } | null } = {}): FinanceItemData & { event_musician?: { user_id: string; instrument: string | null } | null } {
  return {
    id: over.id ?? `item-${Math.random()}`,
    finance_id: 'fin-1',
    category: 'cache_musico',
    label: 'Instrumento — Nome',
    amount: 0,
    paid: false,
    notes: null,
    percent_of_revenue: null,
    is_overridden: false,
    event_musician_id: over.event_musician ? `em-${over.id}` : null,
    ...over,
  }
}

function finance(id: string, name: string, items: ReturnType<typeof item>[]): EventFinanceData {
  return {
    id, event_id: `event-${id}`, name, client: null, product: null,
    event_date: '2026-10-01T00:00:00.000Z',
    expected_revenue: 10000, received_amount: 0, notes: null,
    items, payments: [],
  }
}

const andreBateria = { user_id: 'user-andre', instrument: 'Bateria' }
const andrePercussao = { user_id: 'user-andre', instrument: 'Percussão' }
const tyagoSom = { user_id: 'user-tyago', instrument: 'Equipe de Som' }
const xandaoSom = { user_id: 'user-xandao', instrument: 'Equipe de Som' }
const paulinhoTeclado = { user_id: 'user-paulinho', instrument: 'Teclado' }
const joaoTeclado = { user_id: 'user-joao', instrument: 'Teclado' }

describe('categorizeInstrument — reaproveita os instrumentos já usados na Formação', () => {
  it.each([
    ['Voz Masculina', 'voz'], ['Voz Feminina', 'voz'], ['Vocal', 'voz'], ['Backing Vocal', 'voz'],
    ['Guitarra', 'cordas'], ['Baixo', 'cordas'], ['Violão', 'cordas'], ['Bandolim', 'cordas'], ['Cavaquinho', 'cordas'], ['Viola', 'cordas'],
    ['Bateria', 'percussao'], ['Percussão', 'percussao'], ['Cajón', 'percussao'],
    ['Teclado', 'teclas'], ['Piano', 'teclas'], ['Acordeom', 'teclas'],
    ['Saxofone', 'sopros'], ['Trombone', 'sopros'], ['Trompete', 'sopros'], ['Flauta', 'sopros'],
    ['Técnico', 'producao_tecnica'], ['Equipe de Som', 'producao_tecnica'],
    ['DJ', 'outros'], ['Cerimônia', 'outros'], ['Time SB', 'outros'],
  ])('%s → %s', (instrument, category) => {
    expect(categorizeInstrument(instrument)).toBe(category)
  })

  it('é tolerante a maiúsculas/acentos/espaços (mesma convenção de instrument-icons.ts)', () => {
    expect(categorizeInstrument('EQUIPE DE SOM')).toBe('producao_tecnica')
    expect(categorizeInstrument('  tecnico  ')).toBe('producao_tecnica')
    expect(categorizeInstrument('violao')).toBe('cordas')
  })

  it('reconhece variações legadas sem o picklist atual (Baterista, Guitarrista, Tecladista, Saxofonista, Baixista)', () => {
    expect(categorizeInstrument('Baterista')).toBe('percussao')
    expect(categorizeInstrument('Guitarrista')).toBe('cordas')
    expect(categorizeInstrument('Tecladista')).toBe('teclas')
    expect(categorizeInstrument('Saxofonista')).toBe('sopros')
    expect(categorizeInstrument('Baixista')).toBe('cordas')
  })

  it('instrumento desconhecido cai em "Outros" sem quebrar', () => {
    expect(categorizeInstrument('Harpa Celta')).toBe('outros')
    expect(categorizeInstrument(null)).toBe('outros')
    expect(categorizeInstrument(undefined)).toBe('outros')
  })

  it('TEAM_CATEGORY_ORDER cobre exatamente as chaves de TEAM_CATEGORY_LABELS', () => {
    expect(new Set(TEAM_CATEGORY_ORDER)).toEqual(new Set(Object.keys(TEAM_CATEGORY_LABELS)))
  })
})

describe('buildTeamMatrixRows — a matriz Equipe / Cachês do Financeiro Geral', () => {
  it('TESTE 1: o mesmo membro/função em 3 eventos vira 1 linha com 3 células', () => {
    const finances = [
      finance('a', 'Evento A', [item({ id: 'i1', label: 'Bateria — Andre Batera', amount: 600, event_musician: andreBateria })]),
      finance('b', 'Evento B', [item({ id: 'i2', label: 'Bateria — Andre Batera', amount: 500, event_musician: andreBateria })]),
      finance('c', 'Evento C', [item({ id: 'i3', label: 'Bateria — Andre Batera', amount: 600, event_musician: andreBateria })]),
    ]
    const rows = buildTeamMatrixRows(finances)
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe('Bateria — Andre Batera')
    expect(rows[0].cellsByFinanceId['a'].amount).toBe(600)
    expect(rows[0].cellsByFinanceId['b'].amount).toBe(500)
    expect(rows[0].cellsByFinanceId['c'].amount).toBe(600)
  })

  it('TESTE 2: dois membros diferentes na mesma função viram 2 linhas (Equipe de Som — Tyago x Xandão)', () => {
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', label: 'Equipe de Som — SOM&LUZ Áudio core - Tyago', amount: 7500, event_musician: tyagoSom }),
      item({ id: 'i2', label: 'Equipe de Som — Xandão', amount: 3000, event_musician: xandaoSom }),
    ])]
    const rows = buildTeamMatrixRows(finances)
    const somRows = rows.filter(r => r.category === 'producao_tecnica')
    expect(somRows).toHaveLength(2)
    expect(somRows.map(r => r.label).sort()).toEqual([
      'Equipe de Som — SOM&LUZ Áudio core - Tyago',
      'Equipe de Som — Xandão',
    ])
  })

  it('TESTE 3: dois tecladistas diferentes viram 2 linhas (Paulinho x João)', () => {
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', label: 'Teclado — Paulinho Teclado', amount: 450, event_musician: paulinhoTeclado }),
      item({ id: 'i2', label: 'Teclado — João', amount: 500, event_musician: joaoTeclado }),
    ])]
    const rows = buildTeamMatrixRows(finances)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.label).sort()).toEqual(['Teclado — João', 'Teclado — Paulinho Teclado'])
  })

  it('TESTE 4: o mesmo membro em funções diferentes vira 2 linhas (Andre Batera: Bateria x Percussão)', () => {
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', label: 'Bateria — Andre Batera', amount: 600, event_musician: andreBateria }),
      item({ id: 'i2', label: 'Percussão — Andre Batera', amount: 400, event_musician: andrePercussao }),
    ])]
    const rows = buildTeamMatrixRows(finances)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.label).sort()).toEqual(['Bateria — Andre Batera', 'Percussão — Andre Batera'])
  })

  it('TESTE 5: profissional que não participa de um evento não tem célula (nunca 0,00)', () => {
    const finances = [
      finance('a', 'Evento A', [item({ id: 'i1', label: 'Bateria — Andre Batera', amount: 600, event_musician: andreBateria })]),
      finance('b', 'Evento B', []), // Andre não está neste evento
    ]
    const rows = buildTeamMatrixRows(finances)
    expect(rows[0].cellsByFinanceId['a']).toBeDefined()
    expect(rows[0].cellsByFinanceId['b']).toBeUndefined()
  })

  it('TESTE 6: dois lançamentos legítimos do mesmo membro/função/evento somam na MESMA célula, sem criar 2ª linha', () => {
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', label: 'Bateria — Andre Batera', amount: 300, event_musician: andreBateria }),
      item({ id: 'i2', label: 'Bateria — Andre Batera', amount: 300, event_musician: andreBateria }),
    ])]
    const rows = buildTeamMatrixRows(finances)
    expect(rows).toHaveLength(1)
    expect(rows[0].cellsByFinanceId['a'].amount).toBe(600)
    expect(rows[0].cellsByFinanceId['a'].itemIds.sort()).toEqual(['i1', 'i2'])
  })

  it('TESTE 7: cachê alto (R$ 7.500) permanece exatamente na coluna/evento correto', () => {
    const finances = [
      finance('a', 'Evento A', [item({ id: 'i1', label: 'Equipe de Som — Tyago', amount: 7500, event_musician: tyagoSom })]),
      finance('b', 'Evento B', [item({ id: 'i2', label: 'Equipe de Som — Tyago', amount: 3000, event_musician: tyagoSom })]),
    ]
    const rows = buildTeamMatrixRows(finances)
    expect(rows[0].cellsByFinanceId['a'].amount).toBe(7500)
    expect(rows[0].cellsByFinanceId['b'].amount).toBe(3000)
  })

  it('não usa só o texto do rótulo como identidade: rótulos iguais com musicos diferentes (IDs) não se misturam', () => {
    // Dois "Técnico — Jonatas Tecnico" só devem virar 1 linha se forem o MESMO user_id;
    // aqui simulamos dois cadastros homônimos diferentes para garantir que não colapsam.
    const jonatasA = { user_id: 'user-jonatas-a', instrument: 'Técnico' }
    const jonatasB = { user_id: 'user-jonatas-b', instrument: 'Técnico' }
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', label: 'Técnico — Jonatas Tecnico', amount: 700, event_musician: jonatasA }),
      item({ id: 'i2', label: 'Técnico — Jonatas Tecnico', amount: 700, event_musician: jonatasB }),
    ])]
    const rows = buildTeamMatrixRows(finances)
    expect(rows).toHaveLength(2)
  })

  it('itens órfãos (sem vínculo com EventMusician, dados legados) continuam como linhas próprias, sem se misturar entre eventos', () => {
    const finances = [
      finance('a', 'Evento A', [item({ id: 'orf-1', category: 'dj', label: 'DJ', amount: 500, event_musician: null })]),
      finance('b', 'Evento B', [item({ id: 'orf-2', category: 'dj', label: 'DJ', amount: 400, event_musician: null })]),
    ]
    const rows = buildTeamMatrixRows(finances)
    expect(rows).toHaveLength(2) // não foram agrupados por não terem identidade estável
    expect(rows.every(r => r.category === 'outros')).toBe(true)
    expect(rows.find(r => r.cellsByFinanceId['a'])?.cellsByFinanceId['b']).toBeUndefined()
  })

  it('cor/estado pago da célula: só "pago" quando TODOS os lançamentos somados estão pagos', () => {
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', label: 'Bateria — Andre Batera', amount: 300, paid: true,  event_musician: andreBateria }),
      item({ id: 'i2', label: 'Bateria — Andre Batera', amount: 300, paid: false, event_musician: andreBateria }),
    ])]
    const rows = buildTeamMatrixRows(finances)
    expect(rows[0].cellsByFinanceId['a'].paid).toBe(false)
  })

  it('célula fica "paga" quando o único lançamento (ou todos) está pago', () => {
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', label: 'Bateria — Andre Batera', amount: 300, paid: true, event_musician: andreBateria }),
    ])]
    const rows = buildTeamMatrixRows(finances)
    expect(rows[0].cellsByFinanceId['a'].paid).toBe(true)
  })

  it('ordena por grupo (ordem fixa), depois instrumento, depois nome — de forma determinística, independente da ordem de entrada', () => {
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', label: 'Teclado — Paulinho Teclado', amount: 1, event_musician: paulinhoTeclado }),
      item({ id: 'i2', label: 'Bateria — Andre Batera', amount: 1, event_musician: andreBateria }),
      item({ id: 'i3', label: 'Equipe de Som — Tyago', amount: 1, event_musician: tyagoSom }),
      item({ id: 'i4', label: 'Voz Masculina — Mykie', amount: 1, event_musician: { user_id: 'user-mykie', instrument: 'Voz Masculina' } }),
      item({ id: 'i5', label: 'DJ', category: 'dj', amount: 1, event_musician: null }),
    ])]
    const rows = buildTeamMatrixRows(finances)
    expect(rows.map(r => r.category)).toEqual([
      'voz', 'percussao', 'teclas', 'producao_tecnica', 'outros',
    ])
  })

  it('a ordem das linhas não depende da ordem dos eventos recebidos', () => {
    const itemsEventoA = [item({ id: 'i1', label: 'Teclado — Paulinho Teclado', amount: 1, event_musician: paulinhoTeclado })]
    const itemsEventoB = [item({ id: 'i2', label: 'Bateria — Andre Batera', amount: 1, event_musician: andreBateria })]
    const ordem1 = buildTeamMatrixRows([finance('a', 'A', itemsEventoA), finance('b', 'B', itemsEventoB)])
    const ordem2 = buildTeamMatrixRows([finance('b', 'B', itemsEventoB), finance('a', 'A', itemsEventoA)])
    expect(ordem1.map(r => r.label)).toEqual(ordem2.map(r => r.label))
  })

  it('ignora categorias padrão (não-cache/custom) — não interfere com Pró-labore, Comissão etc.', () => {
    const finances = [finance('a', 'Evento A', [
      item({ id: 'i1', category: 'pro_labore', label: 'Pró-labore', amount: 1000, event_musician: null }),
    ])]
    expect(buildTeamMatrixRows(finances)).toHaveLength(0)
  })

  it('TESTE 8/9 (sanidade): a soma de todas as células da matriz é igual à soma dos itens de custo personalizados originais', () => {
    const finances = [
      finance('a', 'Evento A', [
        item({ id: 'i1', label: 'Bateria — Andre Batera', amount: 600, event_musician: andreBateria }),
        item({ id: 'i2', label: 'Equipe de Som — Tyago', amount: 7500, event_musician: tyagoSom }),
        item({ id: 'i3', category: 'dj', label: 'DJ', amount: 500, event_musician: null }),
      ]),
      finance('b', 'Evento B', [
        item({ id: 'i4', label: 'Bateria — Andre Batera', amount: 700, event_musician: andreBateria }),
      ]),
    ]
    const originalTotal = finances.reduce((s, f) => s + f.items.reduce((s2, i) => s2 + i.amount, 0), 0)
    const rows = buildTeamMatrixRows(finances)
    const matrixTotal = rows.reduce(
      (s, r) => s + Object.values(r.cellsByFinanceId).reduce((s2, c) => s2 + c.amount, 0),
      0
    )
    expect(matrixTotal).toBe(originalTotal)
  })
})
