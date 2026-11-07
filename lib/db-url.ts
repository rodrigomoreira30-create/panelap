// O pooler do Supabase (Supavisor) em session mode (porta 5432) reserva uma vaga por
// cliente, limitada ao pool_size (15). Instâncias serverless seguram essas vagas até
// esgotá-las (EMAXCONNSESSION) e o sistema inteiro para de consultar o banco.
// Em runtime usamos sempre o transaction mode (6543), recomendado para serverless.
// Migrations continuam usando DIRECT_URL (prisma.config.ts), que não passa por aqui.
const SUPABASE_POOLER_HOST = /\.pooler\.supabase\.com$/
const SESSION_PORT = '5432'
const TRANSACTION_PORT = '6543'

export function resolveRuntimeDatabaseUrl<T extends string | undefined>(raw: T): T {
  if (!raw) return raw

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return raw
  }

  const isSessionPooler =
    SUPABASE_POOLER_HOST.test(url.hostname) && (url.port === SESSION_PORT || url.port === '')
  if (!isSessionPooler) return raw

  url.port = TRANSACTION_PORT
  url.searchParams.set('pgbouncer', 'true')
  return url.toString() as T
}
