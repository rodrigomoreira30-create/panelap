'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, Trash2, Loader2, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

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

const SEARCH_THRESHOLD = 8
const SCROLL_THRESHOLD = 5

export function MemberList({ members, currentUserId }: MemberListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    )
  }, [members, query])

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
    <div className="space-y-2">
      {members.length > SEARCH_THRESHOLD && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar membro..."
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div
        data-testid="member-list"
        className={cn(
          'border rounded-lg divide-y',
          members.length > SCROLL_THRESHOLD && 'max-h-80 overflow-y-auto'
        )}
      >
        {filteredMembers.map(member => {
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
        {filteredMembers.length === 0 && (
          <p className="p-3 text-sm text-gray-400">Nenhum membro encontrado.</p>
        )}
      </div>
    </div>
  )
}
