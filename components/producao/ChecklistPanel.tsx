import { ChecklistItemRow } from './ChecklistItemRow'
import type { Checklist } from './EventDetailClient'

type Props = {
  checklists: Checklist[]
  eventoId: string
}

export function ChecklistPanel({ checklists, eventoId }: Props) {
  if (checklists.length === 0) {
    return <p className="text-gray-400 text-sm">Nenhum checklist criado.</p>
  }

  return (
    <div className="space-y-6">
      {checklists.map(checklist => {
        const doneCount = checklist.items.filter(i => i.done).length
        const total = checklist.items.length
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

        return (
          <div key={checklist.id} className="border rounded-lg">
            <div className="flex items-center justify-between p-3 border-b bg-gray-50">
              <span className="font-medium text-sm">{checklist.title}</span>
              <span className="text-xs text-gray-500">{doneCount}/{total} ({pct}%)</span>
            </div>
            <div className="p-1">
              {checklist.items.map(item => (
                <ChecklistItemRow
                  key={item.id}
                  checklistId={checklist.id}
                  item={item}
                  eventoId={eventoId}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
