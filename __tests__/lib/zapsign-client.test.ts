import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createZapSignDocument, getZapSignDocument } from '../../lib/zapsign/client'

const mockDocument = {
  token: 'doc-token-abc',
  name: 'Contrato de Show',
  status: 'pending',
  signers: [
    {
      token: 'signer-token-xyz',
      name: 'João Silva',
      email: 'joao@example.com',
      sign_url: 'https://app.zapsign.com.br/assinar/signer-token-xyz',
      status: 'pending',
    },
  ],
  created_at: '2026-05-27T00:00:00Z',
}

describe('ZapSign Client', () => {
  beforeEach(() => {
    process.env.ZAPSIGN_API_TOKEN = 'test-token-123'
  })

  afterEach(() => {
    delete process.env.ZAPSIGN_API_TOKEN
    vi.unstubAllGlobals()
  })

  describe('createZapSignDocument', () => {
    it('happy path — returns document on 200 response', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockDocument),
        json: async () => mockDocument,
      } as any)
      vi.stubGlobal('fetch', mockFetch)

      const result = await createZapSignDocument({
        name: 'Contrato de Show',
        url_pdf: 'https://example.com/contract.pdf',
        signers: [
          {
            name: 'João Silva',
            email: 'joao@example.com',
            phone_country: '55',
            phone_number: '11999999999',
          },
        ],
      })

      expect(result.token).toBe('doc-token-abc')
      expect(result.name).toBe('Contrato de Show')
      expect(result.status).toBe('pending')
      expect(result.signers).toHaveLength(1)
      expect(result.signers[0].sign_url).toBe(
        'https://app.zapsign.com.br/assinar/signer-token-xyz'
      )

      // Verify correct endpoint and auth header
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.zapsign.com.br/api/v1/docs/',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Token test-token-123',
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('API error — throws descriptive error on 422 response', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => '{"detail": "Invalid PDF URL"}',
      } as any)
      vi.stubGlobal('fetch', mockFetch)

      await expect(
        createZapSignDocument({
          name: 'Contrato',
          url_pdf: 'not-a-url',
          signers: [],
        })
      ).rejects.toThrow('ZapSign API error: 422')
    })

    it('missing token — throws when ZAPSIGN_API_TOKEN is not set', async () => {
      delete process.env.ZAPSIGN_API_TOKEN

      await expect(
        createZapSignDocument({
          name: 'Contrato',
          signers: [],
        })
      ).rejects.toThrow('ZAPSIGN_API_TOKEN is not set')
    })
  })

  describe('getZapSignDocument', () => {
    it('happy path — returns document and uses correct token in URL', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockDocument),
        json: async () => mockDocument,
      } as any)
      vi.stubGlobal('fetch', mockFetch)

      const result = await getZapSignDocument('doc-token-abc')

      expect(result.token).toBe('doc-token-abc')
      expect(result.name).toBe('Contrato de Show')
      expect(result.signers[0].token).toBe('signer-token-xyz')

      // Verify token is in the URL
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.zapsign.com.br/api/v1/docs/doc-token-abc/',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Token test-token-123',
          }),
        })
      )
    })

    it('not found — throws on 404 response', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '{"detail": "Not found."}',
      } as any)
      vi.stubGlobal('fetch', mockFetch)

      await expect(getZapSignDocument('nonexistent-token')).rejects.toThrow(
        'ZapSign API error: 404'
      )
    })
  })
})
