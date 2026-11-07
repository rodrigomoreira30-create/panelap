import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { attachDatabasePool } from '@vercel/functions'
import { PrismaClient } from './generated/prisma/client'
import { resolveRuntimeDatabaseUrl } from './db-url'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const pool = new Pool({
    connectionString: resolveRuntimeDatabaseUrl(process.env.DATABASE_URL),
    max: 3,
    min: 0,
    // Curto para devolver conexões ociosas ao pooler rapidamente (recomendação da Vercel).
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    // Keepalive para evitar que o roteador/NAT feche conexões ociosas
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  })
  pool.on('error', () => {})
  // Na Vercel, fecha as conexões ociosas antes de a instância ser suspensa, para que
  // instâncias congeladas não fiquem segurando vagas do pooler. Fora da Vercel é no-op.
  attachDatabasePool(pool)
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
