import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { BandProvider } from '@/components/shared/BandProvider'
import type { SessionUser } from '@/types'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()

  if (!supabaseUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabase_id: supabaseUser.id },
    include: { band: true },
  })

  if (!dbUser || !dbUser.band || dbUser.band.slug !== bandSlug) redirect('/login')

  const sessionUser: SessionUser = {
    id: dbUser.id,
    band_id: dbUser.band_id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
  }

  return (
    <BandProvider band={dbUser.band} user={sessionUser}>
      <div className="flex h-screen bg-gray-50">
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </BandProvider>
  )
}
