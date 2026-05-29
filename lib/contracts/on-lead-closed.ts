import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events/internal-bus'
import { runContractsAgent } from '@/lib/claude/agents/contracts-agent'

export function registerLeadClosedContractListener() {
  eventBus.on('lead.closed', async ({ lead_id, band_id }) => {
    try {
      await runContractsAgent({ lead_id, band_id })
    } catch (err) {
      console.error('Contracts Agent error:', err)
    }
  })
}
