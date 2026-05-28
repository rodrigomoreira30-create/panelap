/**
 * Replaces {{variable}} placeholders in content with values from data dictionary.
 * Missing variables render as "[variable não informado]" (not an error).
 */
export function fillTemplate(content: string, data: Record<string, string>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmedKey = key.trim()
    return trimmedKey in data ? data[trimmedKey] : `[${trimmedKey} não informado]`
  })
}

/**
 * Returns an array of unique variable names found in {{...}} patterns in the template.
 */
export function extractVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{([^}]+)\}\}/g)
  const seen = new Set<string>()
  for (const match of matches) {
    seen.add(match[1].trim())
  }
  return Array.from(seen)
}

export type LeadForContract = {
  client_name: string
  phone: string
  event_type: string
  event_date: Date | null
  city: string | null
  venue_name: string | null
  budget: { toString(): string } | null // Prisma Decimal — use parseFloat(budget.toString()).toFixed(2)
  observations: string | null
}

/**
 * Maps a Lead (with its related data) to a flat string dictionary for use with fillTemplate.
 */
export function buildContractData(lead: LeadForContract): Record<string, string> {
  const formatDate = (date: Date | null): string => {
    if (date === null) return '[data não informada]'
    return date.toLocaleDateString('pt-BR')
  }

  const formatBudget = (budget: { toString(): string } | null): string => {
    if (budget === null) return '[não informado]'
    return parseFloat(budget.toString()).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  return {
    cliente_nome: lead.client_name,
    cliente_telefone: lead.phone,
    tipo_evento: lead.event_type,
    data_evento: formatDate(lead.event_date),
    cidade: lead.city ?? '[não informado]',
    local: lead.venue_name ?? '[não informado]',
    valor: formatBudget(lead.budget),
    observacoes: lead.observations ?? '',
  }
}
