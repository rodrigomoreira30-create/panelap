'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const TAG_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-yellow-100 text-yellow-700',
  'bg-red-100 text-red-700',
]

function tagColor(tag: string) {
  let hash = 0
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xff
  return TAG_COLORS[hash % TAG_COLORS.length]
}

interface TagsInputProps {
  leadId: string
  initialTags: string[]
}

export function TagsInput({ leadId, initialTags }: TagsInputProps) {
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [inputVisible, setInputVisible] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function saveTags(next: string[], previous: string[]) {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: next }),
    })
    if (!res.ok) {
      setTags(previous)
      toast({ title: 'Erro ao salvar tag', variant: 'destructive' })
    }
  }

  function addTag() {
    const value = inputValue.trim().slice(0, 50)
    if (!value || tags.includes(value)) {
      setInputValue('')
      setInputVisible(false)
      return
    }
    const previous = tags
    const next = [...tags, value]
    setTags(next)
    setInputValue('')
    setInputVisible(false)
    saveTags(next, previous)
  }

  function removeTag(tag: string) {
    const previous = tags
    const next = tags.filter(t => t !== tag)
    setTags(next)
    saveTags(next, previous)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Escape') {
      setInputValue('')
      setInputVisible(false)
    }
  }

  return (
    <div>
      <span className="font-medium text-sm">Tags:</span>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {tags.map(tag => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:opacity-70 transition-opacity"
              title="Remover tag"
            >
              <X size={10} />
            </button>
          </span>
        ))}

        {inputVisible ? (
          <input
            ref={inputRef}
            autoFocus
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder="Nova tag..."
            maxLength={50}
            className="text-xs border border-gray-300 rounded-full px-2 py-0.5 outline-none focus:border-blue-400 w-24"
          />
        ) : (
          <button
            onClick={() => { setInputVisible(true); setTimeout(() => inputRef.current?.focus(), 0) }}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-gray-400 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            <Plus size={10} /> Tag
          </button>
        )}
      </div>
    </div>
  )
}
