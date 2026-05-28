export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerLeadClosedContractListener } = await import(
      '@/lib/contracts/on-lead-closed'
    )
    registerLeadClosedContractListener()

    const { registerProductionLeadClosedListener } = await import('@/lib/production/on-lead-closed')
    registerProductionLeadClosedListener()
  }
}
