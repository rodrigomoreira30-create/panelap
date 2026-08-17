'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Check, Loader2, Bold, Italic, Strikethrough, List, ListOrdered } from 'lucide-react'

interface EventAlignmentNotesProps {
  eventId: string
  initialNotes: string | null
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-gray-200 text-gray-900'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}

export function EventAlignmentNotes({ eventId, initialNotes }: EventAlignmentNotesProps) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const lastSavedRef = useRef(initialNotes ?? '')
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function save(html: string) {
    const content = html === '<p></p>' ? '' : html
    if (content === lastSavedRef.current) return
    setSaving(true)
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: content || null }),
    })
    lastSavedRef.current = content
    setSaving(false)
    setSaved(true)
    if (savedRef.current) clearTimeout(savedRef.current)
    savedRef.current = setTimeout(() => setSaved(false), 2000)
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialNotes ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[160px] text-gray-700 leading-relaxed',
      },
    },
    onBlur: ({ editor }) => {
      save(editor.getHTML())
    },
  })

  useEffect(() => {
    return () => {
      if (savedRef.current) clearTimeout(savedRef.current)
    }
  }, [])

  if (!editor) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Alinhamentos do Evento</h3>
        <span className="text-xs text-gray-400 flex items-center gap-1 h-4">
          {saving && <><Loader2 size={11} className="animate-spin" /> Salvando...</>}
          {!saving && saved && <><Check size={11} className="text-green-500" /> Salvo</>}
        </span>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Negrito (Ctrl+B)"
          >
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Itálico (Ctrl+I)"
          >
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Tachado"
          >
            <Strikethrough size={15} />
          </ToolbarButton>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Lista de marcadores"
          >
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Lista numerada"
          >
            <ListOrdered size={15} />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <div className="p-3">
          <EditorContent editor={editor} />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Salvo automaticamente ao sair do campo
      </p>
    </div>
  )
}
