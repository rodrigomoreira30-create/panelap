import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstrumentPicker } from '@/components/producao/InstrumentPicker'

describe('InstrumentPicker', () => {
  it('mostra "Cerimônia" na categoria Outros', () => {
    render(<InstrumentPicker onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Outros')).toBeInTheDocument()
    expect(screen.getByText('Cerimônia')).toBeInTheDocument()
  })

  it('permite selecionar Cerimônia e clicar em Adicionar', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<InstrumentPicker onSelect={onSelect} onClose={() => {}} />)

    await user.click(screen.getByText('Cerimônia'))
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(onSelect).toHaveBeenCalledWith('Cerimônia')
  })

  it('não exibe mais as opções removidas do seletor', () => {
    render(<InstrumentPicker onSelect={() => {}} onClose={() => {}} />)
    const removed = [
      'Órgão', 'Sintetizador',
      'Baixo (Voz)', 'Barítono', 'Contralto', 'Soprano', 'Tenor',
      'Contrabaixo Acústico', 'Harpa', 'Ukulele', 'Violino', 'Violoncelo',
    ]
    for (const item of removed) {
      expect(screen.queryByText(item)).not.toBeInTheDocument()
    }
  })

  it('mantém as opções que devem continuar disponíveis em cada categoria', () => {
    render(<InstrumentPicker onSelect={() => {}} onClose={() => {}} />)
    const kept = [
      'Acordeom', 'Piano', 'Teclado',
      'Backing Vocal', 'Vocal', 'Voz Feminina', 'Voz Masculina',
      'Baixo', 'Bandolim', 'Cavaquinho', 'Guitarra', 'Viola', 'Violão',
      'Bateria', 'Cajón', 'Percussão',
      'Flauta', 'Saxofone', 'Trombone', 'Trompete',
      'DJ', 'Equipe de Som', 'Técnico', 'Time AllMusic', 'Time Beats', 'Time SB',
    ]
    for (const item of kept) {
      expect(screen.getByRole('button', { name: item })).toBeInTheDocument()
    }
  })
})
