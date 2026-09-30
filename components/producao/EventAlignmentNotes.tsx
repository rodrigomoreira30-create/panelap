'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { AlertCircle, Bold, Check, Italic, List, ListOrdered, Loader2, Strikethrough } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isNotesDirty, buildNotesPayload } from '@/lib/production/alignment-notes'

interface EventAlignmentNotesProps {
  eventId: string
  initialNotes: string | null
  /** Avisa o componente pai (EventTabs) se há edição não salva neste campo, para que ele
   *  possa confirmar antes de trocar de aba e descartar a edição em andamento. */
  onDirtyChange?: (dirty: boolean) => void
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'

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

export function EventAlignmentNotes({ eventId, initialNotes, onDirtyChange }: EventAlignmentNotesProps) {
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const lastSavedRef = useRef(initialNotes ?? '')
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialNotes ?? '',
    editorProps: {
      attributes: {
        // O ProseMirror define role="textbox"/aria-multiline por padrão; como
        // `attributes` substitui o objeto inteiro (não faz merge), repetimos aqui para
        // não perder a acessibilidade do editor.
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[160px] text-gray-700 leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      setDirty(isNotesDirty(editor.getHTML(), lastSavedRef.current))
    },
  })

  async function handleSave() {
    if (!editor) return
    const html = editor.getHTML()
    setStatus('saving')
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildNotesPayload(html)),
      })
      if (!res.ok) throw new Error('Falha ao salvar alinhamentos do evento')

      // O usuário pode ter continuado digitando durante a requisição — o botão só volta
      // a ficar desabilitado se o conteúdo atual for exatamente o que acabou de ser salvo.
      const normalized = buildNotesPayload(html).notes ?? ''
      lastSavedRef.current = normalized
      setDirty(isNotesDirty(editor.getHTML(), normalized))
      setStatus('success')
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    }
  }, [])

  if (!editor) return null

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-900">Alinhamentos do Evento</h3>

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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs flex items-center gap-1">
          {status === 'success' && (
            <span className="text-green-600 flex items-center gap-1">
              <Check size={12} /> Salvo com sucesso
            </span>
          )}
          {status === 'error' && (
            <span className="text-red-500 flex items-center gap-1">
              <AlertCircle size={12} /> Erro ao salvar. Tente novamente.
            </span>
          )}
        </p>
        <Button size="sm" onClick={handleSave} disabled={!dirty || status === 'saving'}>
          {status === 'saving' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" /> Salvando...
            </span>
          ) : (
            'Salvar'
          )}
        </Button>
      </div>
    </div>
  )
}
