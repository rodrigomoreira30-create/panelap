const ASAAS_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

const PLAN_PRICES: Record<string, number> = {
  starter:     97.00,
  pro:        197.00,
  enterprise: 397.00,
}

async function asaasRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown
): Promise<T> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': process.env.ASAAS_API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj?: string
}

export interface AsaasSubscription {
  id: string
  customer: string
  value: number
  status: string
  nextDueDate: string
  cycle: string
  billingType: string
}

export function buildSubscriptionPayload(params: {
  customer_id: string
  plan: string
  band_name: string
}) {
  const nextDue = new Date()
  nextDue.setDate(nextDue.getDate() + 1)

  return {
    customer:          params.customer_id,
    billingType:       'UNDEFINED' as const,
    cycle:             'MONTHLY' as const,
    value:             PLAN_PRICES[params.plan] ?? PLAN_PRICES.starter,
    nextDueDate:       nextDue.toISOString().split('T')[0],
    description:       `PanelAp ${params.plan} — ${params.band_name}`,
    externalReference: params.customer_id,
  }
}

export async function createAsaasCustomer(params: {
  name: string
  email: string
  cpfCnpj?: string
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('/customers', 'POST', params)
}

export async function createAsaasSubscription(params: {
  customer_id: string
  plan: string
  band_name: string
}): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>(
    '/subscriptions',
    'POST',
    buildSubscriptionPayload(params)
  )
}

export async function getAsaasSubscriptions(
  customer_id: string
): Promise<{ data: AsaasSubscription[] }> {
  return asaasRequest<{ data: AsaasSubscription[] }>(
    `/subscriptions?customer=${customer_id}`,
    'GET'
  )
}

export async function getAsaasCustomerPortalUrl(customer_id: string): Promise<string> {
  const data = await asaasRequest<{ url: string }>(
    `/customers/${customer_id}/generateBillingInfoUrl`,
    'GET'
  )
  return data.url
}
