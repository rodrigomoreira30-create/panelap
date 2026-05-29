import { callClaude, buildSystemWithCache, MODEL } from '@/lib/claude/client'
import { POSTSALE_SYSTEM_PROMPT, buildPostsaleContext } from '@/lib/claude/prompts/postsale'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PostsaleTrigger = 'contract_signed' | 'pre_event' | 'post_event'

interface PostsaleAgentInput {
  event_id: string
  trigger: PostsaleTrigger
}

export async function runPostsaleAgent({ event_id, trigger }: PostsaleAgentInput): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: event_id },
    include: { lead: { select: { phone: true } } },
  })

  if (!event) return

  const dynamicContext = buildPostsaleContext(trigger, {
    client_name: event.client_name,
    event_type:  event.event_type,
    event_date:  format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR }),
    venue_name:  event.venue_name,
  })

  const response = await callClaude({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemWithCache(POSTSALE_SYSTEM_PROMPT, dynamicContext),
    messages: [
      { role: 'user', content: 'Gere a mensagem adequada para este momento.' },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return

  const message = textBlock.text.trim()
  if (!message) return

  const phone = event.lead.phone
  if (!phone) return

  await sendWhatsAppMessage({ to: phone, message })
    .catch(err => console.error(`Postsale WhatsApp failed (${trigger}):`, err))
}
