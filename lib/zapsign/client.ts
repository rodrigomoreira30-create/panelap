const BASE_URL = 'https://api.zapsign.com.br/api/v1'

export type ZapSignSigner = {
  name: string
  email: string
  phone_country: string
  phone_number: string
}

export type ZapSignCreateDocumentInput = {
  name: string
  url_pdf?: string
  content?: string
  signers: ZapSignSigner[]
}

export type ZapSignDocument = {
  token: string
  name: string
  status: string
  signers: Array<{
    token: string
    name: string
    email: string
    sign_url: string
    status: string
  }>
  created_at: string
}

function getApiToken(): string {
  const token = process.env.ZAPSIGN_API_TOKEN
  if (!token) {
    throw new Error('ZAPSIGN_API_TOKEN is not set')
  }
  return token
}

export async function createZapSignDocument(
  input: ZapSignCreateDocumentInput
): Promise<ZapSignDocument> {
  const apiToken = getApiToken()

  const response = await fetch(`${BASE_URL}/docs/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ZapSign API error: ${response.status} ${text}`)
  }

  return response.json() as Promise<ZapSignDocument>
}

export async function getZapSignDocument(token: string): Promise<ZapSignDocument> {
  const apiToken = getApiToken()

  const response = await fetch(`${BASE_URL}/docs/${token}/`, {
    method: 'GET',
    headers: {
      Authorization: `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ZapSign API error: ${response.status} ${text}`)
  }

  return response.json() as Promise<ZapSignDocument>
}
