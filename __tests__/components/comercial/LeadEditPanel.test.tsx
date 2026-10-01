import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeadEditPanel } from '@/components/comercial/LeadEditPanel'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

// A aba "Dados" também renderiza LeadStatusSelect/TagsInput/LeadAttractions/LeadDocuments,
// que fazem suas próprias chamadas — stubadas aqui para isolar o que este teste cobre:
// o salvamento dos campos de texto/data/número da aba Dados.
vi.mock('@/components/comercial/LeadStatusSelect', () => ({
  LeadStatusSelect: () => <div data-testid="status-select" />,
}))
vi.mock('@/components/comercial/TagsInput', () => ({
  TagsInput: () => <div data-testid="tags-input" />,
}))
vi.mock('@/components/comercial/LeadAttractions', () => ({
  LeadAttractions: () => <div data-testid="attractions" />,
}))
vi.mock('@/components/comercial/LeadDocuments', () => ({
  LeadDocuments: () => <div data-testid="docs" />,
}))

const STAGES = [{ key: 'proposal_sent', label: 'Proposta Enviada' }]
const SOURCES = [{ key: 'source_1782945762590', label: 'Indicação' }]

// Réplica do lead real "Grupo Commolati" (telefone vazio, orçamento nulo) que disparava
// "Erro ao salvar. Tente novamente." mesmo editando só Cidade/Local.
function commolatiLead(overrides: Partial<Parameters<typeof LeadEditPanel>[0]['lead']> = {}) {
  return {
    id: 'lead-commolati',
    client_name: 'Grupo Commolati',
    phone: '',
    event_type: 'corporate',
    event_date: null,
    city: '',
    venue_name: '',
    budget: null,
    observations: 'Horario do Evento: 19 as 00h00 NOITE',
    assessor: '',
    assessor_phone: '',
    status: 'proposal_sent',
    source: 'source_1782945762590',
    tags: [],
    assignee: null,
    ...overrides,
  }
}

function renderPanel(lead = commolatiLead()) {
  return render(
    <LeadEditPanel
      lead={lead}
      stages={STAGES}
      sources={SOURCES}
      initialDocs={[]}
      initialAttractions={[]}
      initialDiscount={0}
    />
  )
}

async function startEditing(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /editar/i }))
}

function lastRequestBody() {
  return JSON.parse(vi.mocked(fetch).mock.calls.at(-1)![1]!.body as string)
}

describe('LeadEditPanel — aba Dados (Comercial)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('TESTE A: altera Cidade + Local de um lead sem Event associado e persiste (bug real do "Grupo Commolati")', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) } as Response)
    renderPanel()

    await startEditing(user)
    await user.clear(screen.getByPlaceholderText('Cidade'))
    await user.type(screen.getByPlaceholderText('Cidade'), 'Sao Paulo')
    await user.clear(screen.getByPlaceholderText('Nome do local'))
    await user.type(screen.getByPlaceholderText('Nome do local'), 'Quintal do Espeto Santana')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(fetch).toHaveBeenCalledWith('/api/leads/lead-commolati', expect.objectContaining({ method: 'PATCH' }))
    const body = lastRequestBody()
    expect(body.city).toBe('Sao Paulo')
    expect(body.venue_name).toBe('Quintal do Espeto Santana')
    // O telefone vazio do lead é reenviado como veio — é isso que o 422 antigo rejeitava.
    expect(body.phone).toBe('')

    expect(await screen.findByText('Sao Paulo')).toBeInTheDocument()
    expect(screen.getByText('Quintal do Espeto Santana')).toBeInTheDocument()
    expect(screen.queryByText(/erro ao salvar/i)).not.toBeInTheDocument()
  })

  it('TESTE B: altera somente Observações e persiste', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) } as Response)
    renderPanel()

    await startEditing(user)
    const obs = screen.getByPlaceholderText('Observações sobre o lead...')
    await user.clear(obs)
    await user.type(obs, 'Cliente confirmou por telefone')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const body = lastRequestBody()
    expect(body.observations).toBe('Cliente confirmou por telefone')
    expect(await screen.findByText('Cliente confirmou por telefone')).toBeInTheDocument()
  })

  it('TESTE D: altera Orçamento (inclusive para um valor válido) e persiste', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) } as Response)
    renderPanel()

    await startEditing(user)
    await user.type(screen.getByPlaceholderText('0,00'), '18500')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(lastRequestBody().budget).toBe(18500)
    expect(await screen.findByText(/18\.500,00/)).toBeInTheDocument()
  })

  it('TESTE E: altera Assessora + Telefone e persiste', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) } as Response)
    renderPanel()

    await startEditing(user)
    await user.type(screen.getByPlaceholderText('Nome da assessora'), 'Carla Mendes')
    await user.type(screen.getByPlaceholderText('Telefone da assessora'), '11988887777')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const body = lastRequestBody()
    expect(body.assessor).toBe('Carla Mendes')
    expect(body.assessor_phone).toBe('11988887777')
  })

  it('TESTE F: alterar um campo não apaga os demais já preenchidos', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) } as Response)
    renderPanel(commolatiLead({
      city: 'Campinas',
      venue_name: 'Espaço Jardim',
      budget: 12000,
      assessor: 'Fernanda',
      assessor_phone: '11977776666',
    }))

    await startEditing(user)
    await user.clear(screen.getByPlaceholderText('Cidade'))
    await user.type(screen.getByPlaceholderText('Cidade'), 'Sao Paulo')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const body = lastRequestBody()
    expect(body.city).toBe('Sao Paulo')
    // campos não tocados continuam com o valor que já estava salvo — nada vira null/''.
    expect(body.venue_name).toBe('Espaço Jardim')
    expect(body.budget).toBe(12000)
    expect(body.assessor).toBe('Fernanda')
    expect(body.assessor_phone).toBe('11977776666')
    expect(body.observations).toBe('Horario do Evento: 19 as 00h00 NOITE')
  })

  it('em caso de erro real: mantém os valores digitados, mostra a mensagem e loga a causa técnica', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: { fieldErrors: { phone: ['Too small'] } } }),
    } as Response)
    renderPanel()

    await startEditing(user)
    await user.clear(screen.getByPlaceholderText('Cidade'))
    await user.type(screen.getByPlaceholderText('Cidade'), 'Sao Paulo')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Erro ao salvar. Tente novamente.')).toBeInTheDocument()
    // continua em modo de edição, com o valor digitado preservado (não reverte, não apaga)
    expect(screen.getByPlaceholderText('Cidade')).toHaveValue('Sao Paulo')
    expect(consoleError).toHaveBeenCalledWith(
      'Falha ao salvar dados do lead:', 422, expect.objectContaining({ error: expect.anything() })
    )

    consoleError.mockRestore()
  })

  it('TESTE G: lead já convertido em evento (com responsável atribuído) continua salvando normalmente', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) } as Response)
    renderPanel(commolatiLead({
      status: 'closed',
      assignee: { id: 'user-1', name: 'Ana Produtora' },
      city: 'Sao Paulo',
      venue_name: 'Quintal do Espeto Santana',
      budget: 18500,
    }))

    expect(screen.getByText('Ana Produtora')).toBeInTheDocument()

    await startEditing(user)
    await user.type(screen.getByPlaceholderText('Observações sobre o lead...'), ' — revisado')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(fetch).toHaveBeenCalledWith('/api/leads/lead-commolati', expect.objectContaining({ method: 'PATCH' }))
    expect(screen.queryByText(/erro ao salvar/i)).not.toBeInTheDocument()
  })
})
