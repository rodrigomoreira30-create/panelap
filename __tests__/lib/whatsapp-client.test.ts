import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'

describe('sendWhatsAppMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env vars
    delete process.env.WHATSAPP_API_URL
    delete process.env.WHATSAPP_API_TOKEN
  })

  it('throws error when WHATSAPP_API_URL is missing', async () => {
    process.env.WHATSAPP_API_TOKEN = 'token123'

    await expect(
      sendWhatsAppMessage({ to: '5511999999999', message: 'Hello' })
    ).rejects.toThrow('WHATSAPP_API_URL and WHATSAPP_API_TOKEN must be set')
  })

  it('throws error when WHATSAPP_API_TOKEN is missing', async () => {
    process.env.WHATSAPP_API_URL = 'https://api.whatsapp.com'

    await expect(
      sendWhatsAppMessage({ to: '5511999999999', message: 'Hello' })
    ).rejects.toThrow('WHATSAPP_API_URL and WHATSAPP_API_TOKEN must be set')
  })

  it('sends message successfully with valid credentials', async () => {
    process.env.WHATSAPP_API_URL = 'https://api.whatsapp.com'
    process.env.WHATSAPP_API_TOKEN = 'token123'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
    global.fetch = mockFetch

    await sendWhatsAppMessage({ to: '5511999999999', message: 'Hello World' })

    expect(mockFetch).toHaveBeenCalledWith('https://api.whatsapp.com/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123',
      },
      body: JSON.stringify({ to: '5511999999999', message: 'Hello World' }),
    })
  })

  it('throws error when API responds with non-ok status', async () => {
    process.env.WHATSAPP_API_URL = 'https://api.whatsapp.com'
    process.env.WHATSAPP_API_TOKEN = 'token123'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })
    global.fetch = mockFetch

    await expect(
      sendWhatsAppMessage({ to: '5511999999999', message: 'Hello' })
    ).rejects.toThrow('WhatsApp API error 401: Unauthorized')
  })

  it('includes Authorization header with Bearer token', async () => {
    process.env.WHATSAPP_API_URL = 'https://api.whatsapp.com'
    process.env.WHATSAPP_API_TOKEN = 'mytoken456'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
    global.fetch = mockFetch

    await sendWhatsAppMessage({ to: '5511999999999', message: 'Test' })

    const call = mockFetch.mock.calls[0]
    const headers = call[1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer mytoken456')
  })
})
