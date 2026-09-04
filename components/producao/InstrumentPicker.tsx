'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'

const CATEGORIES = [
  {
    label: 'Teclas',
    items: ['Acordeom', 'Órgão', 'Piano', 'Sintetizador', 'Teclado'],
  },
  {
    label: 'Voz',
    items: [
      'Backing Vocal', 'Baixo (Voz)', 'Barítono', 'Contralto',
      'Soprano', 'Tenor', 'Vocal', 'Voz Feminina', 'Voz Masculina',
    ],
  },
  {
    label: 'Cordas',
    items: [
      'Baixo', 'Bandolim', 'Cavaquinho', 'Contrabaixo Acústico',
      'Guitarra', 'Harpa', 'Ukulele', 'Viola', 'Violão', 'Violino', 'Violoncelo',
    ],
  },
  {
    label: 'Percussão',
    items: ['Bateria', 'Cajón', 'Percussão'],
  },
  {
    label: 'Sopros',
    items: ['Flauta', 'Saxofone', 'Trombone', 'Trompete'],
  },
  {
    label: 'Outros',
    items: ['DJ', 'Equipe de Som', 'Técnico', 'Time AllMusic', 'Time Beats', 'Time SB'],
  },
]

interface InstrumentPickerProps {
  onSelect: (instrument: string) => void
  onClose: () => void
}

export function InstrumentPicker({ onSelect, onClose }: InstrumentPickerProps) {
  const [selected, setSelected] = useState<string | null>(null)

  function handleAdd() {
    if (selected) onSelect(selected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Adicionar Instrumento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {CATEGORIES.map(cat => (
            <div key={cat.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {cat.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map(item => {
                  const isSelected = selected === item
                  return (
                    <button
                      key={item}
                      onClick={() => setSelected(isSelected ? null : item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                      {item}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={!selected}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
