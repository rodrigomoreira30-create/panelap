// Matriz "Equipe / Cachês" do Financeiro Geral (FinanceTable).
//
// Hoje cada EventFinanceItem (categoria cache_musico, sincronizado por membro+função por
// EVENTO — ver lib/finance-service.ts) virava uma linha própria na tabela, então o mesmo
// profissional repetia uma linha por show em que tocou. Esta matriz agrupa por
// IDENTIDADE REAL (EventMusician.user_id, estável entre eventos) + função (instrument),
// e distribui os valores nas colunas (eventos) correspondentes — sem alterar nenhum
// total, cálculo ou registro no banco; é só uma transformação para exibição.
import { DEFAULT_FINANCE_ITEMS, resolveItemAmount, type EventFinanceData, type FinanceItemData } from './financas'

// As mesmas 10 categorias fixas da seção "Custos" (Pró-labore, Comissão...) — reaproveita
// DEFAULT_FINANCE_ITEMS em vez de manter uma segunda lista. Tudo que não é uma dessas
// categorias é "custo personalizado" e entra nesta matriz.
const STANDARD_CATEGORIES = new Set(DEFAULT_FINANCE_ITEMS.map(d => d.category))

export type TeamCategoryKey =
  | 'voz' | 'cordas' | 'percussao' | 'teclas' | 'sopros' | 'producao_tecnica' | 'outros'

export const TEAM_CATEGORY_LABELS: Record<TeamCategoryKey, string> = {
  voz:               'Voz',
  cordas:            'Cordas',
  percussao:         'Percussão',
  teclas:            'Teclas',
  sopros:            'Sopros',
  producao_tecnica:  'Produção / Técnica',
  outros:            'Outros',
}

/** Ordem fixa de exibição dos grupos — a mesma em toda sessão/mês, independente da
 *  ordem dos eventos carregados. */
export const TEAM_CATEGORY_ORDER: TeamCategoryKey[] = [
  'voz', 'cordas', 'percussao', 'teclas', 'sopros', 'producao_tecnica', 'outros',
]

// Instrumento/função (normalizado) → grupo. Cobre o picklist atual da Formação
// (components/producao/InstrumentPicker.tsx) e as variações livres encontradas nos
// dados reais (gentílico/plural, categorias legadas sem acento) para não jogar tudo
// isso em "Outros" por divergência de grafia.
const INSTRUMENT_CATEGORY: Record<string, TeamCategoryKey> = {
  // Voz
  'backing vocal': 'voz', 'vocal': 'voz', 'voz feminina': 'voz', 'voz masculina': 'voz',
  'cantor 1': 'voz', 'cantor 2': 'voz', 'cantor 3': 'voz', 'cantor 4': 'voz',
  // Cordas
  'baixo': 'cordas', 'baixista': 'cordas', 'bandolim': 'cordas', 'cavaquinho': 'cordas',
  'guitarra': 'cordas', 'guitarrista': 'cordas', 'viola': 'cordas', 'violao': 'cordas',
  // Percussão
  'bateria': 'percussao', 'baterista': 'percussao', 'cajon': 'percussao', 'percussao': 'percussao',
  // Teclas
  'acordeom': 'teclas', 'sanfoneiro': 'teclas', 'piano': 'teclas', 'teclado': 'teclas', 'tecladista': 'teclas',
  // Sopros
  'flauta': 'sopros', 'saxofone': 'sopros', 'saxofonista': 'sopros', 'trombone': 'sopros', 'trompete': 'sopros',
  // Produção / Técnica
  'tecnico': 'producao_tecnica', 'tecnico de som': 'producao_tecnica', 'tecnico de luz': 'producao_tecnica',
  'equipe de som': 'producao_tecnica',
  // Outros
  'dj': 'outros', 'cerimonia': 'outros', 'time allmusic': 'outros', 'time beats': 'outros', 'time sb': 'outros',
}

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (NFD separa a marca diacrítica)
}

/** Grupo de exibição de um instrumento/função. Qualquer valor não reconhecido (um
 *  instrumento novo, texto livre de um custo legado) cai em "Outros" — nunca quebra. */
export function categorizeInstrument(instrument: string | null | undefined): TeamCategoryKey {
  return INSTRUMENT_CATEGORY[normalizeKey(instrument ?? '')] ?? 'outros'
}

export type TeamMatrixCell = {
  /** Soma de todos os lançamentos desta combinação membro+função NESTE evento — na
   *  prática sempre um único item, mas dois lançamentos legítimos somam na mesma célula
   *  em vez de criar uma segunda linha. */
  amount: number
  /** `true` apenas quando todos os lançamentos somados na célula estão pagos. */
  paid: boolean
  itemIds: string[]
}

export type TeamMatrixRow = {
  /** Chave de agrupamento: `${user_id}::${instrumento normalizado}` para itens vinculados
   *  à Formação; `item:${id}` (nunca agrupa) para lançamentos legados sem vínculo. */
  key: string
  category: TeamCategoryKey
  /** Rótulo completo já pronto para exibição ("Instrumento — Nome"). */
  label: string
  cellsByFinanceId: Record<string, TeamMatrixCell>
}

type FinanceItemWithMusician = FinanceItemData & {
  event_musician?: { user_id: string; instrument: string | null } | null
}

/** Monta as linhas da matriz "Equipe / Cachês" a partir dos financeiros do mês/período —
 *  uma linha por membro+função, com uma célula por evento em que ele participou. Não
 *  altera nenhum valor: a soma de todas as células é sempre igual à soma dos itens de
 *  custo personalizados originais. */
export function buildTeamMatrixRows(finances: EventFinanceData[]): TeamMatrixRow[] {
  const rows = new Map<string, TeamMatrixRow>()

  for (const finance of finances) {
    for (const raw of finance.items) {
      const item = raw as FinanceItemWithMusician
      // Itens com categoria dentre as 10 fixas (Pró-labore, Comissão...) ficam fora desta
      // matriz — continuam exibidos na seção "Custos" da tabela, sem alteração.
      if (STANDARD_CATEGORIES.has(item.category)) continue

      const musician = item.event_musician ?? null
      const key = musician
        ? `${musician.user_id}::${normalizeKey(musician.instrument ?? '')}`
        : `item:${item.id}` // sem identidade estável — nunca agrupa com outra linha

      let row = rows.get(key)
      if (!row) {
        row = {
          key,
          category: categorizeInstrument(musician?.instrument ?? item.label),
          label: item.label,
          cellsByFinanceId: {},
        }
        rows.set(key, row)
      }

      // Mesma resolução já usada em todo o resto da tabela (idêntica a item.amount para
      // custos de equipe, que nunca são percentuais — mantém paridade exata se isso mudar).
      const resolved = resolveItemAmount(item, finance.expected_revenue)

      const existingCell = row.cellsByFinanceId[finance.id]
      if (existingCell) {
        existingCell.amount = round2Local(existingCell.amount + resolved)
        existingCell.paid = existingCell.paid && item.paid
        existingCell.itemIds.push(item.id)
      } else {
        row.cellsByFinanceId[finance.id] = { amount: resolved, paid: item.paid, itemIds: [item.id] }
      }
    }
  }

  return [...rows.values()].sort((a, b) => {
    const catDiff = TEAM_CATEGORY_ORDER.indexOf(a.category) - TEAM_CATEGORY_ORDER.indexOf(b.category)
    if (catDiff !== 0) return catDiff
    return a.label.localeCompare(b.label, 'pt-BR')
  })
}

function round2Local(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
