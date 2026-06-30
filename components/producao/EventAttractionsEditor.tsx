'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadAttractions } from '@/components/comercial/LeadAttractions'

type AttractionItem = {
  id: string
  name: string
  custom_value: number
  observations: string | null
}

interface EventAttractionsEditorProps {
  leadId: string
  initialAttractions: AttractionItem[]
  initialDiscount: number
}

export function EventAttractionsEditor({
  leadId,
  initialAttractions,
  initialDiscount,
}: EventAttractionsEditorProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function handleClose() {
    setOpen(false)
    router.refresh()
  }

  return (
    <div>
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil size={13} className="mr-1" /> Editar Atrações
        </Button>
      ) : (
        <div className="border rounded-lg p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Atrações Contratadas</h3>
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs">
              <ChevronUp size={14} className="mr-1" /> Fechar
            </Button>
          </div>
          <LeadAttractions
            leadId={leadId}
            initialAttractions={initialAttractions}
            initialDiscount={initialDiscount}
          />
        </div>
      )}
    </div>
  )
}
