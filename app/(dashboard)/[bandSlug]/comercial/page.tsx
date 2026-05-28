import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/comercial/KanbanBoard'
import { LeadFormWrapper } from '@/components/comercial/LeadFormWrapper'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

export default async function ComercialPage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { supabase_id: user.id } })
  if (!dbUser) redirect('/login')

  const leads = await prisma.lead.findMany({
    where: { band_id: dbUser.band_id },
    include: { assignee: { select: { id: true, name: true, avatar_url: true } } },
    orderBy: { created_at: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Comercial</h1>
          <p className="text-gray-500 text-sm">Pipeline de leads e oportunidades</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Novo Lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Criar novo lead</DialogTitle></DialogHeader>
            <LeadFormWrapper />
          </DialogContent>
        </Dialog>
      </div>
      <KanbanBoard initialLeads={leads as any} bandSlug={bandSlug} />
    </div>
  )
}
