'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type LeadAttractionItem = {
  id: string
  name: string
  custom_value: number
  observations: string | null
}

type CatalogAttraction = {
  id: string
  name: string
  category: string | null
  default_value: number
  is_active: boolean
}

interface LeadAttractionsProps {
  leadId: string
  initialAttractions: LeadAttractionItem[]
  initialDiscount: number
  onTotalChange?: (total: number) => void
}

function parseBRValue(raw: string): number {
  // Aceita: 9800 | 9.800 | 9800,00 | 9.800,00
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned)
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function computeTotal(attrItems: LeadAttractionItem[], disc: number) {
  return Math.max(0, attrItems.reduce((s, i) => s + i.custom_value, 0) - disc)
}

export function LeadAttractions({ leadId, initialAttractions, initialDiscount, onTotalChange }: LeadAttractionsProps) {
  const [items, setItems] = useState<LeadAttractionItem[]>(initialAttractions)
  const [discount, setDiscount] = useState(initialDiscount)
  const [discountInput, setDiscountInput] = useState(initialDiscount > 0 ? fmt(initialDiscount) : '')
  const [catalog, setCatalog] = useState<CatalogAttraction[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [addValue, setAddValue] = useState('')
  const [addObs, setAddObs] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/attractions')
      .then(r => r.json())
      .then(({ data }) => {
        setCatalog((data as CatalogAttraction[]).filter(a => a.is_active))
      })
      .catch(() => {})
  }, [])

  async function syncBudget(newItems: LeadAttractionItem[], disc: number) {
    const newTotal = computeTotal(newItems, disc)
    onTotalChange?.(newTotal)
    fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget: newTotal }),
    }).catch(() => {})
  }

  function onCatalogSelect(id: string) {
    setSelectedId(id)
    const found = catalog.find(a => a.id === id)
    if (found) setAddValue(String(found.default_value))
  }

  async function handleAdd() {
    if (!selectedId) { setError('Selecione uma atração.'); return }
    const val = parseBRValue(addValue)
    if (isNaN(val) || val < 0) { setError('Valor inválido.'); return }
    setAdding(true)
    setError('')
    const res = await fetch(`/api/leads/${leadId}/attractions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attraction_id: selectedId, custom_value: val, observations: addObs || undefined }),
    })
    setAdding(false)
    if (res.ok) {
      const { data } = await res.json()
      const newItem = { ...data, custom_value: parseFloat(data.custom_value.toString()) }
      const newItems = [...items, newItem]
      setItems(newItems)
      setShowAdd(false)
      setSelectedId('')
      setAddValue('')
      setAddObs('')
      await syncBudget(newItems, discount)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Erro ao adicionar.')
    }
  }

  async function handleValueBlur(item: LeadAttractionItem, rawValue: string) {
    const val = parseBRValue(rawValue)
    if (isNaN(val) || val === item.custom_value) return
    const res = await fetch(`/api/leads/${leadId}/attractions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_value: val }),
    })
    if (res.ok) {
      const newItems = items.map(x => x.id === item.id ? { ...x, custom_value: val } : x)
      setItems(newItems)
      await syncBudget(newItems, discount)
    }
  }

  async function handleObsBlur(item: LeadAttractionItem, obs: string) {
    const normalized = obs || null
    if (normalized === item.observations) return
    await fetch(`/api/leads/${leadId}/attractions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observations: normalized }),
    })
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, observations: normalized } : x))
  }

  async function handleRemove(id: string) {
    const res = await fetch(`/api/leads/${leadId}/attractions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const newItems = items.filter(x => x.id !== id)
      setItems(newItems)
      await syncBudget(newItems, discount)
    }
  }

  async function handleDiscountBlur() {
    const val = parseBRValue(discountInput)
    const safeVal = isNaN(val) || val < 0 ? 0 : val
    setDiscountInput(safeVal > 0 ? fmt(safeVal) : '')
    if (safeVal === discount) return
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_discount: safeVal }),
    })
    if (res.ok) {
      setDiscount(safeVal)
      await syncBudget(items, safeVal)
    }
  }

  const subtotal = items.reduce((s, i) => s + i.custom_value, 0)
  const total = Math.max(0, subtotal - discount)

  return (
    <div className="space-y-3 py-1">
      {items.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400">Nenhuma atração adicionada.</p>
      )}

      {items.map(item => (
        <AttractionRow
          key={item.id}
          item={item}
          onValueBlur={handleValueBlur}
          onObsBlur={handleObsBlur}
          onRemove={handleRemove}
        />
      ))}

      {showAdd ? (
        <div className="border border-dashed border-indigo-300 rounded-lg p-3 space-y-2 bg-indigo-50/30">
          <Select value={selectedId} onValueChange={onCatalogSelect}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Selecione a atração..." />
            </SelectTrigger>
            <SelectContent>
              {catalog.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}{a.category ? ` · ${a.category}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="text"
            value={addValue}
            onChange={e => setAddValue(e.target.value)}
            className="h-8 text-sm"
            placeholder="Ex: 9.800,00"
          />
          <Textarea
            value={addObs}
            onChange={e => setAddObs(e.target.value)}
            className="text-sm min-h-[56px] resize-none"
            placeholder="Observações (opcional)"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={adding} className="flex-1">
              {adding ? <Loader2 size={13} className="animate-spin" /> : 'Confirmar'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setError('') }}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border border-dashed border-indigo-300 rounded-lg py-2 text-xs text-indigo-500 hover:bg-indigo-50 transition-colors font-medium flex items-center justify-center gap-1"
        >
          <Plus size={13} /> Adicionar atração
        </button>
      )}

      {/* Totais */}
      <div className="border-t pt-3 space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Subtotal</span>
          <span>R$ {fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Desconto</span>
          <Input
            type="text"
            value={discountInput}
            onChange={e => setDiscountInput(e.target.value)}
            onFocus={() => { if (discount > 0) setDiscountInput(String(discount)) }}
            onBlur={handleDiscountBlur}
            className="h-7 w-28 text-right text-xs"
            placeholder="0,00"
          />
        </div>
        <div className="flex justify-between items-center text-sm font-bold text-gray-900 pt-1 border-t">
          <span>Total da Proposta</span>
          <span className="text-indigo-600">R$ {fmt(total)}</span>
        </div>
      </div>
    </div>
  )
}

function AttractionRow({
  item,
  onValueBlur,
  onObsBlur,
  onRemove,
}: {
  item: LeadAttractionItem
  onValueBlur: (item: LeadAttractionItem, raw: string) => void
  onObsBlur: (item: LeadAttractionItem, obs: string) => void
  onRemove: (id: string) => void
}) {
  const [value, setValue] = useState(fmt(item.custom_value))
  const [obs, setObs] = useState(item.observations ?? '')
  const [focused, setFocused] = useState(false)

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.name}</div>
        </div>
        <button onClick={() => onRemove(item.id)} className="text-gray-300 hover:text-red-500 transition-colors p-0.5 shrink-0">
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">Valor (R$)</span>
        <Input
          type="text"
          value={focused ? value.replace(/\./g, '').replace(',', '.').replace(/\.(\d{2})$/, ',$1').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => {
            setFocused(true)
            setValue(String(item.custom_value))
          }}

          onBlur={() => {
            setFocused(false)
            const parsed = parseFloat(value.replace(/\./g, '').replace(',', '.'))
            if (!isNaN(parsed)) setValue(fmt(parsed))
            onValueBlur(item, value)
          }}
          className="h-7 text-sm flex-1"
          placeholder="Ex: 9.800,00"
        />
      </div>
      <Textarea
        value={obs}
        onChange={e => setObs(e.target.value)}
        onBlur={() => onObsBlur(item, obs)}
        placeholder="Observações..."
        className="text-xs min-h-[48px] resize-none text-gray-500"
      />
    </div>
  )
}
