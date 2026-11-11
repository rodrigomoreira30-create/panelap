import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { EventTransportCosts } from '@/components/producao/EventTransportCosts'
import type { FinanceItemData } from '@/lib/financas'

function item(over: Partial<FinanceItemData>): FinanceItemData {
  return {
    id: 'item', finance_id: 'finance-1', category: 'transporte', label: 'Transporte',
    amount: 0, paid: false, notes: null, percent_of_revenue: null, is_overridden: false,
    event_musician_id: null, ...over,
  }
}

const tres = [
  item({ id: 't1', label: 'Carro 1 — João', amount: 300, paid: true }),
  item({ id: 't2', label: 'Carro 2 — Carlos', amount: 350 }),
  item({ id: 't3', label: 'Carro 3 — Marcos', amount: 250 }),
  item({ id: 'h1', category: 'hospedagem', label: 'Hospedagem', amount: 1000, paid: true }),
]

function setup(items: FinanceItemData[]) {
  const onPatchItem = vi.fn()
  const onChange = vi.fn()
  const utils = render(
    <EventTransportCosts
      financeId="finance-1"
      items={items}
      revenueForecast={10000}
      onPatchItem={onPatchItem}
      onChange={onChange}
    />
  )
  return { ...utils, onPatchItem, onChange }
}

function expand() {
  fireEvent.click(screen.getByRole('button', { name: /Transporte/ }))
}

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('EventTransportCosts', () => {
  it('mostra o total somado da categoria e o resumo pago/pendente, recolhido por padrão', () => {
    setup(tres)
    expect(screen.getByTestId('transporte-total')).toHaveTextContent('R$ 900,00')
    expect(screen.getByText('Pago R$ 300,00 · Pendente R$ 600,00')).toBeInTheDocument()
    expect(screen.queryAllByTestId('transporte-item')).toHaveLength(0)
    expect(screen.getByTestId('transporte-indicador')).toHaveAttribute('data-paid', 'false')
  })

  it('expandido, lista cada transporte com seu próprio status e ignora outras categorias', () => {
    setup(tres)
    expand()
    const rows = screen.getAllByTestId('transporte-item')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByRole('button', { name: 'Marcar como não pago' })).toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: 'Marcar como pago' })).toBeInTheDocument()
    expect(within(rows[2]).getByRole('button', { name: 'Marcar como pago' })).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Hospedagem')).not.toBeInTheDocument()
    // já há 3 itens: nenhuma linha vazia extra
    expect(screen.queryAllByTestId('transporte-rascunho')).toHaveLength(0)
  })

  it('marca o pagamento somente do transporte clicado', () => {
    const { onPatchItem } = setup(tres)
    expand()
    const rows = screen.getAllByTestId('transporte-item')
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Marcar como pago' }))
    expect(onPatchItem).toHaveBeenCalledTimes(1)
    expect(onPatchItem).toHaveBeenCalledWith('t2', { paid: true })
  })

  it('alterar nome e valor envia o patch do item correspondente', () => {
    const { onPatchItem } = setup(tres)
    expand()
    const row = screen.getAllByTestId('transporte-item')[2]
    const valor = within(row).getByLabelText('Valor do transporte')
    fireEvent.change(valor, { target: { value: '400,00' } })
    fireEvent.blur(valor)
    expect(onPatchItem).toHaveBeenCalledWith('t3', { amount: 400 })

    const nome = within(row).getByLabelText('Nome / identificação do transporte')
    fireEvent.change(nome, { target: { value: 'Van — Marcos' } })
    fireEvent.blur(nome)
    expect(onPatchItem).toHaveBeenCalledWith('t3', { label: 'Van — Marcos' })
  })

  it('não grava nome vazio', () => {
    const { onPatchItem } = setup(tres)
    expand()
    const nome = within(screen.getAllByTestId('transporte-item')[0]).getByLabelText('Nome / identificação do transporte')
    fireEvent.change(nome, { target: { value: '   ' } })
    fireEvent.blur(nome)
    expect(onPatchItem).not.toHaveBeenCalled()
    expect(nome).toHaveValue('Carro 1 — João')
  })

  it('evento legado: o item único existente vira a primeira linha, com valor e status preservados, e completa até 3 linhas sem gravar nada', () => {
    setup([item({ id: 'old', label: 'Transporte', amount: 900, paid: true })])
    expect(screen.getByTestId('transporte-total')).toHaveTextContent('R$ 900,00')
    expect(screen.getByTestId('transporte-indicador')).toHaveAttribute('data-paid', 'true')
    expand()
    const rows = screen.getAllByTestId('transporte-item')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByLabelText('Valor do transporte')).toHaveValue('900,00')
    expect(screen.getAllByTestId('transporte-rascunho')).toHaveLength(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('linha vazia só cria registro quando preenchida e ao sair da linha', async () => {
    const { onChange } = setup([])
    expand()
    const drafts = screen.getAllByTestId('transporte-rascunho')
    expect(drafts).toHaveLength(3)

    // sair de uma linha em branco não grava nada
    fireEvent.blur(within(drafts[0]).getByLabelText('Nome / identificação do novo transporte'))
    expect(fetchMock).not.toHaveBeenCalled()

    const nome = within(drafts[0]).getByLabelText('Nome / identificação do novo transporte')
    const valor = within(drafts[0]).getByLabelText('Valor do novo transporte')
    fireEvent.change(nome, { target: { value: 'Carro 1 — João' } })
    // foco passa do nome para o valor da mesma linha: ainda não grava
    fireEvent.blur(nome, { relatedTarget: valor })
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.change(valor, { target: { value: '300,00' } })
    fireEvent.blur(valor)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/financas/finance-1/items')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ category: 'transporte', label: 'Carro 1 — João', amount: 300 })
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(screen.getAllByTestId('transporte-rascunho')).toHaveLength(2)
  })

  it('"+ Adicionar transporte" abre linhas além das três iniciais', () => {
    setup(tres)
    expand()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar transporte/ }))
    fireEvent.click(screen.getByRole('button', { name: /Adicionar transporte/ }))
    expect(screen.getAllByTestId('transporte-rascunho')).toHaveLength(2)
  })

  it('exclui transporte pendente sem confirmação', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const { onChange } = setup(tres)
    expand()
    fireEvent.click(within(screen.getAllByTestId('transporte-item')[1]).getByRole('button', { name: 'Remover transporte' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/financas/finance-1/items/t2', { method: 'DELETE' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    confirmSpy.mockRestore()
  })

  it('pede confirmação antes de excluir transporte já pago e não exclui se cancelado', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    setup(tres)
    expand()
    fireEvent.click(within(screen.getAllByTestId('transporte-item')[0]).getByRole('button', { name: 'Remover transporte' }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('pagamento de transporte nunca chama a API de recebimentos do cliente', () => {
    setup(tres)
    expand()
    fireEvent.click(within(screen.getAllByTestId('transporte-item')[1]).getByRole('button', { name: 'Marcar como pago' }))
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('payments'))).toBe(false)
  })
})
