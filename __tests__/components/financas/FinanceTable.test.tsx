import { render, screen, within } from '@testing-library/react'
import { FinanceTable } from '@/components/financas/FinanceTable'
import type { EventFinanceData } from '@/lib/financas'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ bandSlug: 'banda-teste' }),
}))

function finance(overrides: Partial<EventFinanceData> = {}): EventFinanceData {
  return {
    id: 'finance-1',
    event_id: 'event-1',
    name: 'Antonio',
    client: null,
    product: null,
    event_date: '2026-09-26T00:00:00.000Z',
    expected_revenue: 18800,
    received_amount: 15000,
    notes: null,
    items: [],
    payments: [],
    ...overrides,
  }
}

describe('FinanceTable — coluna "Total mês" de custos personalizados/Equipe-Cachês', () => {
  it('preenche o Total mês do cachê do músico com o mesmo valor exibido na coluna do evento (não fica em branco)', () => {
    const f = finance({
      items: [{
        id: 'cache-1', finance_id: 'finance-1', category: 'cache_musico',
        label: 'Bateria — André', amount: 700, paid: false, notes: null,
        percent_of_revenue: null, is_overridden: false, event_musician_id: 'em-1',
      }],
    })

    render(<FinanceTable finances={[f]} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)

    // A linha do cachê deve aparecer com o rótulo do músico
    expect(screen.getByText('Bateria — André')).toBeInTheDocument()

    // Todas as ocorrências de "700,00" na linha (coluna do evento + Total mês) devem existir —
    // antes da correção, a célula de Total mês ficava em branco.
    const valores = screen.getAllByText('700,00')
    expect(valores.length).toBeGreaterThanOrEqual(2)
  })

  it('"Valor recebido" da linha usa computeReceivedAmount (18.800, não os 15.000 legados)', () => {
    const f = finance({
      payments: [
        { id: 'p1', finance_id: 'finance-1', payment_date: '2026-09-17T00:00:00.000Z', amount: 3800, payment_method: 'PIX', notes: null },
        { id: 'p2', finance_id: 'finance-1', payment_date: '2026-09-18T00:00:00.000Z', amount: 15000, payment_method: 'PIX', notes: null },
      ],
    })

    render(<FinanceTable finances={[f]} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)

    const valores = screen.getAllByText('18.800,00')
    expect(valores.length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('15.000,00')).not.toBeInTheDocument()
  })
})

function cacheItem(over: Partial<{
  id: string; label: string; amount: number; paid: boolean
  event_musician: { user_id: string; instrument: string } | null
}>) {
  return {
    id: over.id ?? `item-${Math.random()}`,
    finance_id: 'x',
    category: 'cache_musico',
    label: over.label ?? '',
    amount: over.amount ?? 0,
    paid: over.paid ?? false,
    notes: null,
    percent_of_revenue: null,
    is_overridden: false,
    event_musician_id: over.event_musician ? `em-${over.id}` : null,
    event_musician: over.event_musician ?? null,
  }
}

describe('FinanceTable — matriz "Equipe / Cachês" agrupada por membro + função', () => {
  it('o mesmo membro/função em 3 eventos aparece em UMA linha, com o cachê de cada evento na coluna certa', () => {
    const andre = { user_id: 'user-andre', instrument: 'Bateria' }
    const finances = [
      finance({ id: 'a', event_id: 'ev-a', name: 'Evento A', items: [cacheItem({ id: 'i1', label: 'Bateria — Andre Batera', amount: 600, event_musician: andre })] }),
      finance({ id: 'b', event_id: 'ev-b', name: 'Evento B', items: [cacheItem({ id: 'i2', label: 'Bateria — Andre Batera', amount: 500, event_musician: andre })] }),
      finance({ id: 'c', event_id: 'ev-c', name: 'Evento C', items: [cacheItem({ id: 'i3', label: 'Bateria — Andre Batera', amount: 600, event_musician: andre })] }),
    ]

    render(<FinanceTable finances={finances} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)

    // Uma única linha com o rótulo — não três
    expect(screen.getAllByText('Bateria — Andre Batera')).toHaveLength(1)
    const row = within(screen.getByText('Bateria — Andre Batera').closest('tr')!)
    const cells = row.getAllByRole('cell').map(td => td.textContent)
    // Evento A, Evento B, Evento C, Total da linha
    expect(cells).toEqual(['Bateria — Andre Batera', '600,00', '500,00', '600,00', '1.700,00'])
  })

  it('dois membros diferentes na mesma função viram duas linhas distintas (Equipe de Som — Tyago x Xandão)', () => {
    const f = finance({
      items: [
        cacheItem({ id: 'i1', label: 'Equipe de Som — Tyago', amount: 7500, event_musician: { user_id: 'user-tyago', instrument: 'Equipe de Som' } }),
        cacheItem({ id: 'i2', label: 'Equipe de Som — Xandão', amount: 3000, event_musician: { user_id: 'user-xandao', instrument: 'Equipe de Som' } }),
      ],
    })

    render(<FinanceTable finances={[f]} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)

    expect(screen.getByText('Equipe de Som — Tyago')).toBeInTheDocument()
    expect(screen.getByText('Equipe de Som — Xandão')).toBeInTheDocument()
    const rowTyago = within(screen.getByText('Equipe de Som — Tyago').closest('tr')!)
    expect(rowTyago.getAllByText('7.500,00').length).toBeGreaterThan(0)
  })

  it('profissional que não participa de um evento mostra "—" na coluna, nunca "0,00"', () => {
    const andre = { user_id: 'user-andre', instrument: 'Bateria' }
    const finances = [
      finance({ id: 'a', event_id: 'ev-a', name: 'Evento A', items: [cacheItem({ id: 'i1', label: 'Bateria — Andre Batera', amount: 600, event_musician: andre })] }),
      finance({ id: 'b', event_id: 'ev-b', name: 'Evento B', items: [] }),
    ]

    render(<FinanceTable finances={finances} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)

    const row = within(screen.getByText('Bateria — Andre Batera').closest('tr')!)
    expect(row.getAllByText('600,00').length).toBeGreaterThan(0) // coluna do Evento A + Total da linha
    expect(row.getByText('—')).toBeInTheDocument()
    expect(row.queryByText('0,00')).not.toBeInTheDocument()
  })

  it('exibe o cabeçalho do grupo (ex.: "Produção / Técnica") acima das linhas daquela categoria', () => {
    const f = finance({
      items: [cacheItem({ id: 'i1', label: 'Equipe de Som — Tyago', amount: 7500, event_musician: { user_id: 'user-tyago', instrument: 'Equipe de Som' } })],
    })

    render(<FinanceTable finances={[f]} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)

    expect(screen.getByText('Produção / Técnica')).toBeInTheDocument()
  })
})

describe('FinanceTable — valores abrem o Financeiro do evento em nova aba', () => {
  function linksIn(rowLabel: string) {
    const row = within(screen.getByText(rowLabel).closest('tr')!)
    return row.queryAllByRole('link') as HTMLAnchorElement[]
  }

  const tresEventos = () => [
    finance({ id: 'fa', event_id: 'ev-lucas', name: 'Lucas & Sabrina', expected_revenue: 10000,
      items: [{ id: 't1', finance_id: 'fa', category: 'transporte', label: 'Transporte', amount: 500, paid: false, notes: null, percent_of_revenue: null, is_overridden: false, event_musician_id: null }] }),
    finance({ id: 'fb', event_id: 'ev-mauro', name: 'Mauro César', expected_revenue: 12000 }),
    finance({ id: 'fc', event_id: 'ev-mateus', name: 'Mateus', expected_revenue: 9000 }),
  ]

  it('Transporte (R$ 500,00 de Lucas & Sabrina) é um link nativo para o Financeiro do evento, em nova aba', () => {
    render(<FinanceTable finances={tresEventos()} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)
    const link = within(screen.getByText('Transporte').closest('tr')!).getByRole('link', { name: '500,00' })
    expect(link).toHaveAttribute('href', '/banda-teste/producao/ev-lucas?tab=financeiro')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('cada coluna aponta para o ID do seu próprio evento (Receita prevista)', () => {
    render(<FinanceTable finances={tresEventos()} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)
    expect(linksIn('Receita prevista').map(a => a.getAttribute('href'))).toEqual([
      '/banda-teste/producao/ev-lucas?tab=financeiro',
      '/banda-teste/producao/ev-mauro?tab=financeiro',
      '/banda-teste/producao/ev-mateus?tab=financeiro',
    ])
  })

  it.each(['Valor recebido', 'Saldo a receber', 'Total de custos', 'Lucro previsto', 'Lucro real'])(
    '"%s" tem um link por evento, todos em nova aba (coluna Total mês sem link)',
    label => {
      render(<FinanceTable finances={tresEventos()} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)
      const links = linksIn(label)
      expect(links).toHaveLength(3)
      links.forEach(a => expect(a).toHaveAttribute('target', '_blank'))
    },
  )

  it('cachê de músico em Custos personalizados abre o evento correspondente', () => {
    const andre = { user_id: 'user-andre', instrument: 'Bateria' }
    const finances = [
      finance({ id: 'a', event_id: 'ev-a', name: 'Evento A', items: [] }),
      finance({ id: 'b', event_id: 'ev-b', name: 'Evento B', items: [cacheItem({ id: 'i2', label: 'Bateria — Andre Batera', amount: 500, event_musician: andre })] }),
    ]
    render(<FinanceTable finances={finances} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)
    const link = within(screen.getByText('Bateria — Andre Batera').closest('tr')!).getByRole('link', { name: '500,00' })
    expect(link).toHaveAttribute('href', '/banda-teste/producao/ev-b?tab=financeiro')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('financeiro sem evento vinculado não gera link (mantém o valor exibido)', () => {
    render(<FinanceTable finances={[finance({ event_id: null })]} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getAllByText('18.800,00').length).toBeGreaterThan(0)
  })
})

describe('FinanceTable — Transporte detalhado (vários itens na categoria)', () => {
  function transporte(id: string, label: string, amount: number, paid = false) {
    return {
      id, finance_id: 'finance-1', category: 'transporte', label, amount, paid, notes: null,
      percent_of_revenue: null, is_overridden: false, event_musician_id: null,
    }
  }

  it('exibe uma única linha Transporte com a soma dos itens do evento, sem linhas separadas', () => {
    const f = finance({
      name: 'Lucas & Sabrina',
      items: [
        transporte('t1', 'Carro 1 — João', 300, true),
        transporte('t2', 'Carro 2 — Carlos', 350),
        transporte('t3', 'Carro 3 — Marcos', 250),
      ],
    })

    render(<FinanceTable finances={[f]} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)

    const row = screen.getByText('Transporte').closest('tr')!
    // coluna do evento + Total mês
    expect(within(row).getAllByText('900,00')).toHaveLength(2)
    expect(within(row).getAllByText('900,00')[0].closest('td')!.className).toContain('text-red-600')
    expect(screen.queryByText('Carro 1 — João')).not.toBeInTheDocument()
    expect(screen.queryByText('300,00')).not.toBeInTheDocument()
  })

  it('fica verde quando todos os transportes estão pagos', () => {
    const f = finance({
      items: [transporte('t1', 'A', 300, true), transporte('t2', 'B', 350, true)],
    })

    render(<FinanceTable finances={[f]} onFinanceUpdated={() => {}} onFinanceDeleted={() => {}} />)

    const row = screen.getByText('Transporte').closest('tr')!
    expect(within(row).getAllByText('650,00')[0].closest('td')!.className).toContain('text-green-600')
  })
})
