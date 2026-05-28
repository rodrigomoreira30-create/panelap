interface SendMessageParams {
  to: string
  message: string
}

export async function sendWhatsAppMessage({ to, message }: SendMessageParams): Promise<void> {
  const apiUrl = process.env.WHATSAPP_API_URL
  const apiToken = process.env.WHATSAPP_API_TOKEN

  if (!apiUrl || !apiToken) {
    throw new Error('WHATSAPP_API_URL and WHATSAPP_API_TOKEN must be set')
  }

  const res = await fetch(`${apiUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ to, message }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`WhatsApp API error ${res.status}: ${body}`)
  }
}
