import { render, screen } from '@testing-library/react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import type { SessionUser } from '@/types'

function makeSession(role: SessionUser['role']): SessionUser {
  return { id: '1', band_id: 'b1', name: 'Test', email: 'a@b.com', role }
}

describe('RoleGuard', () => {
  it('renderiza children quando role está na lista permitida', () => {
    render(
      <RoleGuard user={makeSession('admin')} allowed={['admin', 'commercial']}>
        <span>Conteúdo</span>
      </RoleGuard>
    )
    expect(screen.getByText('Conteúdo')).toBeInTheDocument()
  })

  it('não renderiza children quando role não está na lista', () => {
    render(
      <RoleGuard user={makeSession('musician')} allowed={['admin']}>
        <span>Conteúdo</span>
      </RoleGuard>
    )
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument()
  })

  it('renderiza fallback quando fornecido e role não permitido', () => {
    render(
      <RoleGuard
        user={makeSession('musician')}
        allowed={['admin']}
        fallback={<span>Sem acesso</span>}
      >
        <span>Conteúdo</span>
      </RoleGuard>
    )
    expect(screen.getByText('Sem acesso')).toBeInTheDocument()
  })
})
