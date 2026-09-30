// Lógica de salvamento explícito de "Alinhamentos do Evento" (Produção → Evento → Geral).
// Extraída para fora do componente para ser testável sem depender do editor Tiptap/DOM.

/** O Tiptap sempre devolve "<p></p>" para um editor vazio. Tratamos isso como string
 *  vazia, para comparar corretamente com o valor salvo (que pode ser `null`/"" no banco)
 *  e não marcar como "alterado" um editor recém-carregado sem conteúdo. */
export function normalizeNotesContent(html: string): string {
  return html === '<p></p>' ? '' : html
}

/** `true` quando o conteúdo atual do editor diverge do último conteúdo confirmado pelo
 *  backend. É o que habilita o botão Salvar e o que dispara o aviso de alterações não
 *  salvas ao trocar de aba — nunca a existência de um evento de blur. */
export function isNotesDirty(currentHtml: string, lastSaved: string): boolean {
  return normalizeNotesContent(currentHtml) !== lastSaved
}

/** Corpo do PATCH /api/events/[id]: mesma convenção já usada pelo backend (`notes: null`
 *  para "sem conteúdo", nunca string vazia). */
export function buildNotesPayload(html: string): { notes: string | null } {
  const content = normalizeNotesContent(html)
  return { notes: content || null }
}

/** Decide se a troca de aba do evento (EventTabs) precisa confirmar o descarte de uma
 *  edição pendente em Alinhamentos do Evento — só se aplica saindo de fato da aba
 *  "geral" (onde o campo vive) com o conteúdo ainda não salvo. */
export function shouldConfirmTabChange(currentTab: string, nextTab: string, dirty: boolean): boolean {
  return currentTab === 'geral' && nextTab !== currentTab && dirty
}
