import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function registerAgendaEventCreatedListener() {
  eventBus.on('event.created', async ({ event_id, band_id: _band_id }) => {
    try {
      const event = await prisma.event.findUnique({
        where: { id: event_id },
        include: {
          event_musicians: {
            include: { user: { select: { id: true, name: true, phone: true } } },
          },
        },
      })

      if (!event) return

      const dateStr = format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

      for (const em of event.event_musicians) {
        if (!em.user.phone) continue

        const confirmUrl = `${appUrl}/api/musicians/${em.id}/confirm?action=confirm`
        const declineUrl = `${appUrl}/api/musicians/${em.id}/confirm?action=decline`

        await sendWhatsAppMessage({
          to: em.user.phone,
          message:
            `Olá ${em.user.name}! 🎵\n` +
            `Você foi escalado para o evento:\n` +
            `📅 ${dateStr}\n` +
            `📍 ${event.venue_name} — ${event.client_name}\n\n` +
            `Confirmar: ${confirmUrl}\n` +
            `Recusar: ${declineUrl}`,
        }).catch(err => console.error(`Falha ao notificar músico ${em.user.id}:`, err))
      }
    } catch (err) {
      console.error('Erro no listener event.created (agenda):', err)
    }
  })
}
