import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsSection } from '@/components/configuracoes/SettingsSection'

describe('SettingsSection', () => {
  it('inicia fechado por padrão, mostrando título e descrição', () => {
    render(
      <SettingsSection title="Membros da Banda" description="9 membros">
        <p>Conteúdo interno</p>
      </SettingsSection>
    )
    expect(screen.getByText('Membros da Banda')).toBeInTheDocument()
    expect(screen.getByText('9 membros')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Membros da Banda/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('abre ao clicar no cabeçalho, atualizando aria-expanded', async () => {
    const user = userEvent.setup()
    render(
      <SettingsSection title="Etapas do Pipeline" description="6 etapas">
        <p>Conteúdo interno</p>
      </SettingsSection>
    )
    const header = screen.getByRole('button', { name: /Etapas do Pipeline/ })
    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('mantém o conteúdo montado mesmo quando a seção está fechada', () => {
    render(
      <SettingsSection title="Fontes de Lead" description="5 fontes">
        <p>Conteúdo interno</p>
      </SettingsSection>
    )
    // A seção inicia fechada (defaultOpen não informado), mas o filho
    // precisa continuar no DOM para preservar estado não salvo.
    expect(screen.getByText('Conteúdo interno')).toBeInTheDocument()
  })

  it('respeita defaultOpen quando informado', () => {
    render(
      <SettingsSection title="Assinatura" description="Resumo do plano atual" defaultOpen>
        <p>Conteúdo interno</p>
      </SettingsSection>
    )
    expect(screen.getByRole('button', { name: /Assinatura/ })).toHaveAttribute('aria-expanded', 'true')
  })
})
