'use client'

import { useState } from 'react'
import { Ban, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

export interface EventCancellation {
  cancelled_at: string | null
  cancellation_reason: string | null
}

interface EventCancellationControlProps {
  eventId: string
  cancellation: EventCancellation
  onChange: (next: EventCancellation) => void
}

/**
 * Botão "Cancelar Evento" / "Reativar Evento" com confirmação. Cancelar só marca o evento
 * (cancelled_at + motivo); nada é excluído e o status original é preservado.
 */
export function EventCancellationControl({ eventId, cancellation, onChange }: EventCancellationControlProps) {
  const cancelled = cancellation.cancelled_at != null
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openDialog() {
    setReason('')
    setError('')
    setOpen(true)
  }

  async function handleConfirm() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/events/${eventId}/cancellation`, {
      method: cancelled ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cancelled ? undefined : JSON.stringify({ reason: reason.trim() || null }),
    }).catch(() => null)
    setSaving(false)

    if (!res?.ok) {
      setError(cancelled
        ? 'Erro ao reativar o evento. Tente novamente.'
        : 'Erro ao cancelar o evento. Tente novamente.')
      return
    }

    const { data } = await res.json()
    onChange({
      cancelled_at: data.cancelled_at ? new Date(data.cancelled_at).toISOString() : null,
      cancellation_reason: data.cancellation_reason ?? null,
    })
    setOpen(false)
  }

  return (
    <>
      {cancelled ? (
        <Button variant="outline" size="sm" onClick={openDialog}>
          <RotateCcw size={13} className="mr-1" /> Reativar Evento
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={openDialog}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <Ban size={13} className="mr-1" /> Cancelar Evento
        </Button>
      )}

      <Dialog open={open} onOpenChange={o => { if (!saving) setOpen(o) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{cancelled ? 'Reativar evento' : 'Cancelar evento'}</DialogTitle>
            <DialogDescription>
              {cancelled
                ? 'Tem certeza de que deseja reativar este evento? Ele voltará a aparecer na agenda com a cor correspondente à sua situação atual.'
                : 'Tem certeza de que deseja cancelar este evento? Ele será identificado como cancelado na agenda, mas suas informações continuarão armazenadas no sistema.'}
            </DialogDescription>
          </DialogHeader>

          {!cancelled && (
            <div className="space-y-1.5">
              <label htmlFor="cancellation-reason" className="text-sm font-medium text-gray-700">
                Motivo do cancelamento <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <Textarea
                id="cancellation-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Ex.: cliente desistiu do evento"
              />
            </div>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Voltar
            </Button>
            {cancelled ? (
              <Button type="button" onClick={handleConfirm} disabled={saving}>
                {saving && <Loader2 size={13} className="mr-1 animate-spin" />}
                Confirmar reativação
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {saving && <Loader2 size={13} className="mr-1 animate-spin" />}
                Confirmar cancelamento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
