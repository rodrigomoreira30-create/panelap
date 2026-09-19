import { render, screen } from '@testing-library/react'
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
