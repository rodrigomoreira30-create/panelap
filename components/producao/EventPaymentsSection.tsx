'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { fmt, parseBR, type EventPaymentData } from '@/lib/financas'

const PAYMENT_METHODS = ['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Boleto', 'Cheque', 'Outro'] as const

function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

type FormState = {
  payment_date: string
  amount: string
  payment_method: string
  notes: string
}

function emptyForm(): FormState {
  return { payment_date: todayInput(), amount: '', payment_method: 'PIX', notes: '' }
}

function toForm(p: EventPaymentData): FormState {
  return {
    payment_date:   p.payment_date.slice(0, 10),
    amount:         fmt(p.amount),
    payment_method: p.payment_method,
    notes:          p.notes ?? '',
  }
}

interface EventPaymentsSectionProps {
  financeId: string
  payments: EventPaymentData[]
  onChange: () => void
}

export function EventPaymentsSection({ financeId, payments, onChange }: EventPaymentsSectionProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EventPaymentData | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setOpen(true)
  }

  function openEdit(p: EventPaymentData) {
    setEditing(p)
    setForm(toForm(p))
    setError('')
    setOpen(true)
  }

  function set(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amount = parseBR(form.amount)
    if (isNaN(amount) || amount <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    if (!form.payment_date) {
      setError('Informe a data do recebimento.')
      return
    }

    setSaving(true)
    const payload = {
      payment_date:   form.payment_date,
      amount,
      payment_method: form.payment_method,
      notes:          form.notes || undefined,
    }

    const url = editing
      ? `/api/financas/${financeId}/payments/${editing.id}`
      : `/api/financas/${financeId}/payments`

    const res = await fetch(url, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)
    if (res.ok) {
      setOpen(false)
      onChange()
    } else {
      setError('Erro ao salvar o recebimento. Tente novamente.')
    }
  }

  async function handleDelete(p: EventPaymentData) {
    if (!confirm(`Tem certeza que deseja excluir este recebimento de R$ ${fmt(p.amount)}?`)) return
    const res = await fetch(`/api/financas/${financeId}/payments/${p.id}`, { method: 'DELETE' })
    if (res.ok) onChange()
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Recebimentos</h3>

      {payments.length === 0 ? (
        <p className="text-sm text-gray-400 mb-3">Nenhum recebimento registrado.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {payments.map(p => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 border rounded-md px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 flex-1 min-w-0">
                <span className="text-gray-500 shrink-0 w-20">
                  {new Date(p.payment_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
                <span className="font-medium text-gray-900 shrink-0">R$ {fmt(p.amount)}</span>
                <span className="text-gray-500 shrink-0">{p.payment_method}</span>
                {p.notes && <span className="text-gray-400 truncate">{p.notes}</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => openEdit(p)}
                  title="Editar recebimento"
                  aria-label="Editar recebimento"
                  className="p-1 text-gray-400 hover:text-gray-700"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  title="Excluir recebimento"
                  aria-label="Excluir recebimento"
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={openCreate}>
        <Plus size={14} className="mr-1" /> Registrar recebimento
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar recebimento' : 'Registrar recebimento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={e => set('payment_date', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Forma de pagamento *</Label>
              <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder='Ex: "Entrada", "2º pagamento"...'
                rows={2}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
