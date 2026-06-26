'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const roleLabels: Record<string, string> = {
  admin:      'Admin',
  commercial: 'Comercial',
  producer:   'Produtor',
  musician:   'Músico',
  singer:     'Cantor(a)',
}

type MemberItem = {
  id: string
  name: string
  email: string
  role: string
}

interface MemberListProps {
  members: MemberItem[]
  currentUserId: string
}

export function MemberList({ members, currentUserId }: MemberListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(member: MemberItem) {
    if (!confirm(`Remover ${member.name} da banda?`)) return
    setDeletingId(member.id)
    const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) {
      toast({ title: `${member.name} removido da banda.` })
      router.refresh()
    } else {
      const json = await res.json().catch(() => ({}))
      toast({ title: json.error ?? 'Erro ao remover membro', variant: 'destructive' })
    }
  }

  return (
    <div className="border rounded-lg divide-y">
      {members.map(member => {
        const isSelf = member.id === currentUserId
        return (
          <div key={member.id} className="flex items-center gap-3 p-3">
            <Avatar>
              <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {member.name}
                {isSelf && <span className="text-gray-400 text-xs ml-2">(você)</span>}
              </p>
              <p className="text-xs text-gray-400 truncate">{member.email}</p>
            </div>
            <Badge variant="outline">{roleLabels[member.role] ?? member.role}</Badge>
            {!isSelf && (
              <button
                onClick={() => handleDelete(member)}
                disabled={deletingId === member.id}
                className="ml-1 p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                title="Remover membro"
              >
                {deletingId === member.id
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Trash2 size={15} />
                }
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
