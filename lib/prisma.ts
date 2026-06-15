import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    min: 0,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
    // Keepalive para evitar que o roteador/NAT feche conexões ociosas
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  })
  pool.on('error', () => {})
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
