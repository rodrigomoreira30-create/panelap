import { NextResponse } from 'next/server'
import type { UserRole } from '@/lib/generated/prisma/enums'

/** Perfis com acesso ao painel administrativo — a mesma regra do layout do dashboard,
 *  que redireciona `musician` para a agenda individual (/musico/[token]). Músicos
 *  consultam agenda e cachê por essa página, nunca pelas APIs do painel. */
export const STAFF_ROLES: readonly UserRole[] = ['admin', 'commercial', 'producer', 'singer']

export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role)
}

/** 403 quando o usuário autenticado não é do painel; null quando pode seguir. */
export function forbiddenUnlessStaff(user: { role?: string | null }): NextResponse | null {
  if (isStaffRole(user.role)) return null
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
