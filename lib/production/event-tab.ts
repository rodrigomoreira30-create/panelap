export const EVENT_TABS = ['geral', 'formacao', 'anexos', 'financeiro', 'tarefas', 'chat'] as const

export type EventTab = typeof EVENT_TABS[number]

/** Converte o `?tab=` da URL numa aba válida do evento; valores desconhecidos caem em "Geral". */
export function parseInitialTab(value: string | string[] | undefined): EventTab {
  const v = Array.isArray(value) ? value[0] : value
  return (EVENT_TABS as readonly string[]).includes(v ?? '') ? (v as EventTab) : 'geral'
}
