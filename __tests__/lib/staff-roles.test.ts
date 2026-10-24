import { describe, it, expect } from 'vitest'
import { isStaffRole, forbiddenUnlessStaff, STAFF_ROLES } from '@/lib/auth/roles'

describe('isStaffRole', () => {
  it.each(['admin', 'commercial', 'producer', 'singer'])('%s tem acesso ao painel', role => {
    expect(isStaffRole(role)).toBe(true)
  })

  it('musician não tem acesso ao painel', () => {
    expect(isStaffRole('musician')).toBe(false)
  })

  it('papel ausente ou desconhecido é negado (fail closed)', () => {
    expect(isStaffRole(undefined)).toBe(false)
    expect(isStaffRole(null)).toBe(false)
    expect(isStaffRole('')).toBe(false)
    expect(isStaffRole('fornecedor')).toBe(false)
  })

  it('não inclui musician na lista de perfis do painel', () => {
    expect(STAFF_ROLES).not.toContain('musician')
  })
})

describe('forbiddenUnlessStaff', () => {
  it('devolve null para perfis do painel', () => {
    expect(forbiddenUnlessStaff({ role: 'admin' })).toBeNull()
  })

  it('devolve 403 para musician', async () => {
    const res = forbiddenUnlessStaff({ role: 'musician' })
    expect(res?.status).toBe(403)
    expect(await res?.json()).toEqual({ error: 'Forbidden' })
  })

  it('devolve 403 quando o papel não foi carregado', () => {
    expect(forbiddenUnlessStaff({})?.status).toBe(403)
  })
})
