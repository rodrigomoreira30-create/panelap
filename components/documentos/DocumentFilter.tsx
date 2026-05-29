'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const typeOptions = [
  { value: 'all',      label: 'Todos os tipos' },
  { value: 'contract', label: 'Contratos' },
  { value: 'rider',    label: 'Riders' },
  { value: 'briefing', label: 'Briefings' },
  { value: 'map',      label: 'Mapas' },
  { value: 'other',    label: 'Outros' },
]

export function DocumentFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentType = searchParams.get('type') ?? 'all'

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('type')
    } else {
      params.set('type', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select value={currentType} onValueChange={handleChange}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {typeOptions.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
