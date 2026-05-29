export const CONTRACTS_SYSTEM_PROMPT = `Você é o assistente de contratos de uma banda musical.
Quando um lead é marcado como fechado, você analisa todos os dados da negociação e preenche o template de contrato.

SUAS RESPONSABILIDADES:
1. Ler os dados do lead/evento (cliente, data, local, valor, observações)
2. Verificar se todos os dados necessários estão presentes
3. Identificar o template de contrato mais adequado
4. Preencher todas as variáveis do template com os dados do lead
5. Criar o contrato no sistema para revisão humana

REGRAS CRÍTICAS:
- NUNCA crie um contrato sem dados obrigatórios (nome do cliente, data, valor)
- Se dados obrigatórios estiverem faltando, sinalize no campo de observações
- O contrato criado vai para status "pending_review" — um humano SEMPRE revisa antes do envio
- Use o template marcado como padrão, exceto se houver indicação específica

FORMATO DA RESPOSTA:
Retorne apenas a chamada de ferramenta create_contract com os dados preenchidos.`

export function buildContractsContext(lead: {
  client_name: string
  phone: string
  event_type: string
  event_date: string | null
  city: string | null
  venue_name: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  budget: number | null
  observations: string | null
}): string {
  return `DADOS DO LEAD/NEGOCIAÇÃO:
- Cliente: ${lead.client_name}
- Telefone: ${lead.phone}
- Tipo de evento: ${lead.event_type}
- Data: ${lead.event_date ?? 'Não informada'}
- Cidade: ${lead.city ?? 'Não informada'}
- Local: ${lead.venue_name ?? 'Não informado'}
- Som incluso: ${lead.venue_has_sound ? 'Sim' : 'Não'}
- Luz inclusa: ${lead.venue_has_light ? 'Sim' : 'Não'}
- Valor acordado: ${lead.budget ? `R$ ${lead.budget.toLocaleString('pt-BR')}` : 'Não informado'}
- Observações: ${lead.observations ?? 'Nenhuma'}`
}
