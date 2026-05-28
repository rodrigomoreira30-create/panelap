'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface MessageThreadProps {
  leadId: string
  messages: Message[]
}

export function MessageThread({ leadId, messages: initialMessages }: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function sendMessage() {
    if (!text.trim()) return
    setSending(true)

    try {
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })

      if (res.ok) {
        const { data } = await res.json()
        setMessages(prev => [...prev, data])
        setText('')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">Nenhuma mensagem ainda</p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.direction === 'out' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-xs px-3 py-2 rounded-lg text-sm',
                msg.direction === 'out'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <p>{msg.content}</p>
              <p className={cn(
                'text-xs mt-1',
                msg.direction === 'out' ? 'text-green-100' : 'text-gray-400'
              )}>
                {format(new Date(msg.sent_at as Date), 'HH:mm', { locale: ptBR })}
                {msg.sent_by === 'agent' && ' · IA'}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-3 flex gap-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Digite uma mensagem..."
          className="resize-none h-16"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
        />
        <Button onClick={sendMessage} disabled={sending || !text.trim()} className="shrink-0">
          Enviar
        </Button>
      </div>
    </div>
  )
}
