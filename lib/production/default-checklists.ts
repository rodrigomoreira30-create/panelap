interface ChecklistItemTemplate {
  description: string
}

const WEDDING_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Confirmar horário de entrada com organizador' },
  { description: 'Confirmar horário de saída' },
  { description: 'Verificar estrutura de som do local' },
  { description: 'Verificar estrutura de luz do local' },
  { description: 'Confirmar playlist com os noivos' },
  { description: 'Confirmar músicas especiais (entrada, valsa)' },
  { description: 'Levar rider técnico para visita' },
  { description: 'Confirmar equipe escalada' },
  { description: 'Reservar transporte dos equipamentos' },
  { description: 'Confirmar alimentação da equipe com organizador' },
  { description: 'Verificar estacionamento para carga/descarga' },
]

const SHOW_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Confirmar abertura de portas e horário do show' },
  { description: 'Enviar rider técnico para o produtor local' },
  { description: 'Confirmar passagem de som (soundcheck)' },
  { description: 'Verificar camarim disponível' },
  { description: 'Confirmar equipe de palco (roadies locais)' },
  { description: 'Confirmar setlist final' },
  { description: 'Verificar projeção/telões (se aplicável)' },
  { description: 'Confirmar backline (se incluso no contrato)' },
  { description: 'Reservar transporte da banda e equipamentos' },
]

const CORPORATE_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Receber briefing completo do evento' },
  { description: 'Confirmar repertório adequado ao perfil corporativo' },
  { description: 'Verificar sala/palco disponível' },
  { description: 'Confirmar horário de montagem' },
  { description: 'Confirmar tempo de apresentação' },
  { description: 'Verificar estrutura de som do local' },
  { description: 'Confirmar contato do produtor do evento' },
]

const PARTY_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Confirmar horário de início e encerramento' },
  { description: 'Verificar estrutura de som do local' },
  { description: 'Confirmar repertório com o cliente' },
  { description: 'Confirmar equipe escalada' },
  { description: 'Reservar transporte dos equipamentos' },
  { description: 'Verificar acesso ao local para carga' },
]

const GENERIC_CHECKLIST: ChecklistItemTemplate[] = [
  { description: 'Confirmar horário e data com o cliente' },
  { description: 'Confirmar local e endereço' },
  { description: 'Verificar necessidades técnicas' },
  { description: 'Confirmar equipe escalada' },
  { description: 'Organizar transporte e logística' },
]

const CHECKLISTS: Record<string, ChecklistItemTemplate[]> = {
  wedding:   WEDDING_CHECKLIST,
  show:      SHOW_CHECKLIST,
  corporate: CORPORATE_CHECKLIST,
  party:     PARTY_CHECKLIST,
  other:     GENERIC_CHECKLIST,
}

export function getDefaultChecklist(eventType: string): ChecklistItemTemplate[] {
  return CHECKLISTS[eventType] ?? GENERIC_CHECKLIST
}
