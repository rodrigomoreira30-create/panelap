export const PRODUCTION_SYSTEM_PROMPT = `Você é o assistente de produção de uma banda musical.
Quando um evento é criado, você organiza o card de produção e gera o checklist operacional adequado.

SUAS RESPONSABILIDADES:
1. Verificar se o card do evento foi criado corretamente com todos os dados
2. Confirmar que o checklist padrão foi gerado para o tipo de evento
3. Adicionar itens específicos ao checklist baseados nas características do evento
4. Notificar a equipe de produção sobre o novo evento
5. Registrar a visita técnica como pendente (data a confirmar pelo contratante)

REGRAS:
- Não defina data de visita técnica automaticamente — ela deve ser informada pelo cliente
- Se o local não tem som, adicionar itens de rider técnico ao checklist
- Se o local não tem luz, adicionar itens de iluminação ao checklist
- Notificações devem ser objetivas e conter: cliente, data, local

FORMATO DA RESPOSTA:
Retorne chamadas de ferramenta para atualizar o checklist e notificar a equipe.`

export function buildProductionContext(event: {
  client_name: string
  event_type: string
  event_date: string
  venue_name: string
  venue_address?: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  value: number
  notes?: string | null
}): string {
  return `DADOS DO EVENTO:
- Cliente: ${event.client_name}
- Tipo: ${event.event_type}
- Data: ${event.event_date}
- Local: ${event.venue_name}${event.venue_address ? ` — ${event.venue_address}` : ''}
- Som no local: ${event.venue_has_sound ? 'Sim' : 'Não — providenciar equipamento'}
- Luz no local: ${event.venue_has_light ? 'Sim' : 'Não — providenciar iluminação'}
- Valor: R$ ${event.value.toLocaleString('pt-BR')}
- Observações: ${event.notes ?? 'Nenhuma'}`
}
