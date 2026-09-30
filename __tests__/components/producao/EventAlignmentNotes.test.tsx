import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventAlignmentNotes } from '@/components/producao/EventAlignmentNotes'

// jsdom não implementa layout: o ProseMirror (editor de "Alinhamentos do Evento") chama
// estas APIs de geometria ao processar clique/digitação no contenteditable. Sem elas, cada
// interação real (userEvent.click/type) lança um erro não tratado que derruba a suíte,
// mesmo a asserção do teste em si passando. Não afeta nenhum outro teste do projeto —
// nenhum outro chama estas APIs hoje.
beforeAll(() => {
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function () {
      return { length: 0, item: () => null, [Symbol.iterator]: function* () {} } as unknown as DOMRectList
    }
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} } as DOMRect
    }
  }
})

describe('EventAlignmentNotes — salvamento explícito (sem autosave)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('o botão Salvar começa desabilitado quando não há alteração', () => {
    render(<EventAlignmentNotes eventId="event-1" initialNotes="<p>Chegar às 14h</p>" />)
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled()
  })

  it('não exibe mais o texto de autosave removido', () => {
    render(<EventAlignmentNotes eventId="event-1" initialNotes="<p>Texto</p>" />)
    expect(screen.queryByText(/salvo automaticamente ao sair do campo/i)).not.toBeInTheDocument()
  })

  it('digitar habilita o botão Salvar, sem nenhum fetch automático', async () => {
    const user = userEvent.setup()
    render(<EventAlignmentNotes eventId="event-1" initialNotes="" />)

    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Levar rider técnico')

    expect(screen.getByRole('button', { name: /salvar/i })).toBeEnabled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('clicar em Salvar mostra "Salvando...", chama a API e depois "Salvo com sucesso"', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true, status: 200, json: async () => ({}),
      } as Response), 30))
    )
    render(<EventAlignmentNotes eventId="event-42" initialNotes="" />)

    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Confirmar horário com o buffet')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled()

    await waitFor(() => expect(screen.getByText(/salvo com sucesso/i)).toBeInTheDocument())

    expect(fetch).toHaveBeenCalledWith(
      '/api/events/event-42',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Confirmar horário com o buffet'),
      })
    )
    // Depois de confirmado pelo backend, sem mais edições, o botão volta a ficar desabilitado.
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled()
  })

  it('em caso de erro: mantém o texto digitado, mostra a mensagem de erro e reabilita o botão', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
    render(<EventAlignmentNotes eventId="event-1" initialNotes="" />)

    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Conteúdo que vai falhar ao salvar')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(screen.getByText(/erro ao salvar\. tente novamente\./i)).toBeInTheDocument())

    expect(screen.queryByText(/salvo com sucesso/i)).not.toBeInTheDocument()
    expect(screen.getByText('Conteúdo que vai falhar ao salvar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvar/i })).toBeEnabled()
  })

  it('falha de rede (fetch rejeita) tem o mesmo comportamento de erro', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'))
    render(<EventAlignmentNotes eventId="event-1" initialNotes="" />)

    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Texto qualquer')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => expect(screen.getByText(/erro ao salvar\. tente novamente\./i)).toBeInTheDocument())
    expect(screen.getByText('Texto qualquer')).toBeInTheDocument()
  })

  it('avisa o componente pai (onDirtyChange) sobre edição pendente, para o aviso de troca de aba', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<EventAlignmentNotes eventId="event-1" initialNotes="" onDirtyChange={onDirtyChange} />)

    expect(onDirtyChange).toHaveBeenLastCalledWith(false)

    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'X')

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
  })

  it('persistência real: após salvar com sucesso, reabrir com o novo conteúdo como initialNotes reflete o valor salvo', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response)
    const { unmount } = render(<EventAlignmentNotes eventId="event-1" initialNotes="" />)

    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Novo conteúdo definitivo')
    await user.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(screen.getByText(/salvo com sucesso/i)).toBeInTheDocument())

    const sentBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    unmount()

    // Simula reabrir a página: o servidor agora devolveria o conteúdo recém-salvo.
    render(<EventAlignmentNotes eventId="event-1" initialNotes={sentBody.notes} />)
    expect(screen.getByText('Novo conteúdo definitivo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled()
  })
})
