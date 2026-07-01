import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bandaallmusic.com.br'
const FROM = 'Panel Eventos <onboarding@resend.dev>'

export async function sendEventInviteEmail({
  to,
  musicianName,
  eventName,
  eventDate,
  scheduleToken,
}: {
  to: string
  musicianName: string
  eventName: string
  eventDate: Date
  scheduleToken: string
}) {
  const agendaUrl = `${APP_URL}/musico/${scheduleToken}`

  const dateFormatted = eventDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Novo evento na sua agenda — ${eventName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
        <h2 style="margin:0 0 8px">Olá, ${musicianName}!</h2>
        <p style="margin:0 0 16px;color:#444">
          Panel Eventos inseriu um evento em sua agenda, verifique e confirme o evento direto na agenda virtual.
        </p>
        <table style="width:100%;background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:24px">
          <tr><td style="font-weight:600">Evento</td><td>${eventName}</td></tr>
          <tr><td style="font-weight:600;padding-top:8px">Data</td><td style="padding-top:8px">${dateFormatted}</td></tr>
        </table>
        <a
          href="${agendaUrl}"
          style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600"
        >
          Ver minha agenda
        </a>
        <p style="margin-top:24px;font-size:12px;color:#999">
          Este é um email automático do Panel Eventos. Não responda este email.
        </p>
      </div>
    `,
  })
}
