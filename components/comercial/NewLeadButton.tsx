'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { LeadForm } from './LeadForm'

export function NewLeadButton() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  function handleSuccess() {
    setOpen(false)
    queryClient.invalidateQueries({ queryKey: ['leads'] })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus size={16} className="mr-2" />Novo Lead</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Criar novo lead</DialogTitle></DialogHeader>
        <LeadForm onSuccess={handleSuccess} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
