import type { ReactNode } from 'react'
import type { SessionUser } from '@/types'

interface RoleGuardProps {
  user: SessionUser
  allowed: SessionUser['role'][]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGuard({ user, allowed, children, fallback = null }: RoleGuardProps) {
  if (!allowed.includes(user.role)) return <>{fallback}</>
  return <>{children}</>
}
