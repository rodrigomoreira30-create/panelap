'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type ChecklistItemProps = {
  checklistId: string
  item: {
    id: string
    description: string
    done: boolean
  }
}

export function ChecklistItemRow({ checklistId, item }: ChecklistItemProps) {
  const [done, setDone] = useState(item.done)
  const [updating, setUpdating] = useState(false)

  async function toggle() {
    setUpdating(true)
    const newDone = !done
    setDone(newDone) // Optimistic update
    try {
      await fetch(`/api/checklists/${checklistId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, done: newDone }),
      })
    } catch {
      setDone(!newDone) // Rollback on error
    } finally {
      setUpdating(false)
    }
  }

  return (
    <label className={cn(
      'flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-gray-50 transition-colors',
      updating && 'opacity-50'
    )}>
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        disabled={updating}
        className="h-4 w-4 rounded"
      />
      <span className={cn('text-sm', done && 'line-through text-gray-400')}>
        {item.description}
      </span>
    </label>
  )
}
