'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { ChecklistItem } from './EventDetailClient'

type Props = {
  checklistId: string
  item: ChecklistItem
  eventoId: string
}

export function ChecklistItemRow({ checklistId, item, eventoId }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ['event', eventoId]

  const toggleMutation = useMutation({
    mutationFn: async (newDone: boolean) => {
      const res = await fetch(`/api/checklists/${checklistId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, done: newDone }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar item')
    },
    onMutate: async (newDone) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: any) => ({
        ...old,
        checklists: (old?.checklists ?? []).map((c: any) =>
          c.id === checklistId
            ? { ...c, items: c.items.map((i: any) => i.id === item.id ? { ...i, done: newDone } : i) }
            : c
        ),
      }))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return (
    <label className={cn(
      'flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-gray-50 transition-colors',
      toggleMutation.isPending && 'opacity-50'
    )}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => toggleMutation.mutate(!item.done)}
        disabled={toggleMutation.isPending}
        className="h-4 w-4 rounded"
      />
      <span className={cn('text-sm', item.done && 'line-through text-gray-400')}>
        {item.description}
      </span>
    </label>
  )
}
