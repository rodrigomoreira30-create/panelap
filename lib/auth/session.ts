import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/generated/prisma/enums'

export type SessionUser = {
  id: string
  band_id: string
  supabase_id: string
  role: UserRole
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: user.id },
    select: { id: true, band_id: true, supabase_id: true, role: true }
  })
  return dbUser ?? null
}
