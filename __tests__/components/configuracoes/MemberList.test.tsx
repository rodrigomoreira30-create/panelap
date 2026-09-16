import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemberList } from '@/components/configuracoes/MemberList'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

function makeMembers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `Membro ${i}`,
    email: `membro${i}@banda.com`,
    role: 'musician',
  }))
}

describe('MemberList', () => {
  it('não mostra campo de busca com poucos membros', () => {
    render(<MemberList members={makeMembers(3)} currentUserId="0" />)
    expect(screen.queryByPlaceholderText('Buscar membro...')).not.toBeInTheDocument()
  })

  it('mostra campo de busca quando há mais de 8 membros', () => {
    render(<MemberList members={makeMembers(9)} currentUserId="0" />)
    expect(screen.getByPlaceholderText('Buscar membro...')).toBeInTheDocument()
  })

  it('filtra membros por nome ao digitar na busca', async () => {
    const user = userEvent.setup()
    render(<MemberList members={makeMembers(9)} currentUserId="0" />)
    await user.type(screen.getByPlaceholderText('Buscar membro...'), 'Membro 3')
    expect(screen.getByText('Membro 3')).toBeInTheDocument()
    expect(screen.queryByText('Membro 1')).not.toBeInTheDocument()
  })

  it('mostra mensagem quando a busca não encontra ninguém', async () => {
    const user = userEvent.setup()
    render(<MemberList members={makeMembers(9)} currentUserId="0" />)
    await user.type(screen.getByPlaceholderText('Buscar membro...'), 'zzz')
    expect(screen.getByText('Nenhum membro encontrado.')).toBeInTheDocument()
  })

  it('aplica scroll interno quando há mais de 5 membros', () => {
    render(<MemberList members={makeMembers(6)} currentUserId="0" />)
    expect(screen.getByTestId('member-list')).toHaveClass('max-h-80', 'overflow-y-auto')
  })

  it('não aplica scroll interno com 5 membros ou menos', () => {
    render(<MemberList members={makeMembers(5)} currentUserId="0" />)
    expect(screen.getByTestId('member-list')).not.toHaveClass('max-h-80')
  })
})
