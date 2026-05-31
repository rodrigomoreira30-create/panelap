'use client'

import { useQuery } from '@tanstack/react-query'
import { ChecklistPanel } from './ChecklistPanel'
import { TeamPanel } from './TeamPanel'

export type ChecklistItem = {
  id: string
  description: string
  done: boolean
}

export type Checklist = {
  id: string
  title: string
  items: ChecklistItem[]
}

export type EventMusician = {
  id: string
  user_id: string
  instrument: string | null
  status: 'pending' | 'confirmed' | 'declined'
  user: { id: string; name: string; avatar_url: string | null }
}

export type EventData = {
  checklists: Checklist[]
  event_musicians: EventMusician[]
}

type BandMember = { id: string; name: string }

type Props = {
  eventoId: string
  bandMembers: BandMember[]
}

async function fetchEventData(eventoId: string): Promise<EventData> {
  const res = await fetch(`/api/events/${eventoId}`)
  if (!res.ok) throw new Error('Falha ao carregar dados do evento')
  const json = await res.json()
  return {
    checklists: json.data.checklists,
    event_musicians: json.data.event_musicians,
  }
}

export function EventDetailClient({ eventoId, bandMembers }: Props) {
  const { data, isError, refetch } = useQuery({
    queryKey: ['event', eventoId],
    queryFn: () => fetchEventData(eventoId),
  })

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-4 text-gray-500">
        <p>Não foi possível carregar os dados do evento.</p>
        <button onClick={() => refetch()} className="text-sm underline hover:text-gray-700">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Checklists Operacionais</h2>
        <ChecklistPanel checklists={data?.checklists ?? []} eventoId={eventoId} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Equipe Escalada</h2>
        <TeamPanel
          eventId={eventoId}
          musicians={data?.event_musicians ?? []}
          bandMembers={bandMembers}
        />
      </div>
    </>
  )
}
