'use client'

import { useState } from 'react'
import { Search, X, Check } from 'lucide-react'

interface BandMember {
  id: string
  name: string
}

interface AssignMusicianModalProps {
  instrument: string
  currentUserId: string | null
  bandMembers: BandMember[]
  assignedUserIds: string[]
  onConfirm: (userId: string, cacheValue: number | null) => void
  onClose: () => void
}

export function AssignMusicianModal({
  instrument,
  currentUserId,
  bandMembers,
  assignedUserIds,
  onConfirm,
  onClose,
}: AssignMusicianModalProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(currentUserId)
  const [cacheValue, setCacheValue] = useState('')

  const available = bandMembers.filter(m => {
    const notAssigned = !assignedUserIds.includes(m.id) || m.id === currentUserId
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return notAssigned && matchesSearch
  })

  function handleConfirm() {
    if (!selectedId) return
    const parsed = cacheValue ? parseFloat(cacheValue.replace(',', '.')) : null
    onConfirm(selectedId, isNaN(parsed as number) ? null : parsed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Atribuir Músico</h2>
            <p className="text-sm text-gray-500 mt-0.5">{instrument}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {available.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {search ? 'Nenhum membro encontrado' : 'Nenhum membro disponível'}
            </p>
          ) : (
            <div className="space-y-1 py-2">
              {available.map(m => {
                const isSelected = selectedId === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(isSelected ? null : m.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-indigo-50 border border-indigo-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700 shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {m.name}
                    </span>
                    {isSelected && <Check size={15} className="text-indigo-600 shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Cache field */}
        <div className="px-5 pb-4 border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Valor do Cachê (R$) <span className="text-gray-400 font-normal">— opcional</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={cacheValue}
            onChange={e => setCacheValue(e.target.value)}
            placeholder="0,00"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
