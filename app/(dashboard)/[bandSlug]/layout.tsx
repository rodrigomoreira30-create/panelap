import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { BandProvider } from '@/components/shared/BandProvider'
import { Sidebar } from '@/components/shared/Sidebar'
import { QueryProvider } from '@/components/shared/QueryProvider'
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

  if (dbUser.role === 'musician') {
    redirect(dbUser.schedule_token ? `/musico/${dbUser.schedule_token}` : '/login')
  }

  const sessionUser: SessionUser = {
    id: dbUser.id,
    band_id: dbUser.band_id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
  }

  return (
    <BandProvider band={dbUser.band} user={sessionUser}>
      <QueryProvider>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </QueryProvider>
    </BandProvider>
  )
}
