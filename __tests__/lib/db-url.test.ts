import { describe, it, expect } from 'vitest'
import { resolveRuntimeDatabaseUrl } from '@/lib/db-url'

const pooler = 'postgresql://postgres.abc:segredo@aws-0-sa-east-1.pooler.supabase.com'

describe('resolveRuntimeDatabaseUrl', () => {
  it('troca o pooler do Supabase de session mode (5432) para transaction mode (6543)', () => {
    const url = new URL(resolveRuntimeDatabaseUrl(`${pooler}:5432/postgres`))
    expect(url.port).toBe('6543')
    expect(url.searchParams.get('pgbouncer')).toBe('true')
    expect(url.pathname).toBe('/postgres')
    expect(url.password).toBe('segredo')
  })

  it('preserva parâmetros já existentes', () => {
    const url = new URL(resolveRuntimeDatabaseUrl(`${pooler}:5432/postgres?sslmode=require`))
    expect(url.searchParams.get('sslmode')).toBe('require')
    expect(url.port).toBe('6543')
  })

  it('não altera URL que já está em transaction mode', () => {
    const input = `${pooler}:6543/postgres?pgbouncer=true`
    expect(resolveRuntimeDatabaseUrl(input)).toBe(input)
  })

  it('não altera bancos fora do pooler do Supabase (ex.: Postgres local)', () => {
    const input = 'postgresql://postgres:x@localhost:5432/panelap?schema=public'
    expect(resolveRuntimeDatabaseUrl(input)).toBe(input)
  })

  it('não altera conexão direta do Supabase (db.<ref>.supabase.co)', () => {
    const input = 'postgresql://postgres:x@db.abc.supabase.co:5432/postgres'
    expect(resolveRuntimeDatabaseUrl(input)).toBe(input)
  })

  it('devolve o valor original quando a URL é inválida ou ausente', () => {
    expect(resolveRuntimeDatabaseUrl('')).toBe('')
    expect(resolveRuntimeDatabaseUrl(undefined)).toBeUndefined()
    expect(resolveRuntimeDatabaseUrl('não-é-url')).toBe('não-é-url')
  })
})
