'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const roleLabels: Record<string, string> = {
  admin:      'Admin',
  commercial: 'Comercial',
  producer:   'Produtor',
  musician:   'Músico',
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
  return (
    <div className="border rounded-lg divide-y">
      {members.map(member => (
        <div key={member.id} className="flex items-center gap-3 p-3">
          <Avatar>
            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-sm">
              {member.name}
              {member.id === currentUserId && (
                <span className="text-gray-400 text-xs ml-2">(você)</span>
              )}
            </p>
            <p className="text-xs text-gray-400">{member.email}</p>
          </div>
          <Badge variant="outline">{roleLabels[member.role] ?? member.role}</Badge>
        </div>
      ))}
    </div>
  )
}
