/** Formata o cachê de uma atribuição (`EventMusician.cache_value`) para exibição
 * na agenda individual do músico. Retorna `null` quando não há valor cadastrado
 * (null/undefined) ou quando o valor é zero — nesses casos a linha de cachê deve
 * ficar oculta no card, em vez de mostrar "Cachê: R$ 0,00". */
export function formatCacheValue(
  cacheValue: { toString(): string } | number | null | undefined
): string | null {
  if (cacheValue == null) return null
  const n = Number(cacheValue)
  if (!(n > 0)) return null
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
