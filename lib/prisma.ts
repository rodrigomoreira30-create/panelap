import { PrismaClient } from './generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientOptions: any =
  process.env.NODE_ENV === 'development' ? { log: ['query'] } : {}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(clientOptions)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
