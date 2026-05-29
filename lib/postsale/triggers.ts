import { prisma } from '@/lib/prisma'
import { runPostsaleAgent } from '@/lib/claude/agents/postsale-agent'
import { eventBus } from '@/lib/events/internal-bus'

export function registerPostsaleContractSignedListener() {
  eventBus.on('contract.signed', async ({ contract_id }) => {
    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contract_id },
        select: { event_id: true },
      })
      if (!contract) return
      await runPostsaleAgent({ event_id: contract.event_id, trigger: 'contract_signed' })
    } catch (err) {
      console.error('Postsale contract_signed error:', err)
    }
  })
}

export async function triggerPreEventMessages(): Promise<void> {
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + 20)

  const dayStart = new Date(targetDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(targetDate)
  dayEnd.setHours(23, 59, 59, 999)

  const events = await prisma.event.findMany({
    where: {
      event_date: { gte: dayStart, lte: dayEnd },
      status: { in: ['contracted', 'active'] as ('contracted' | 'active')[] },
    },
  })

  for (const event of events) {
    await runPostsaleAgent({ event_id: event.id, trigger: 'pre_event' })
      .catch(err => console.error(`Pre-event trigger failed for ${event.id}:`, err))
  }
}

export async function triggerPostEventMessages(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const dayStart = new Date(yesterday)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(yesterday)
  dayEnd.setHours(23, 59, 59, 999)

  const events = await prisma.event.findMany({
    where: {
      event_date: { gte: dayStart, lte: dayEnd },
    },
  })

  for (const event of events) {
    await runPostsaleAgent({ event_id: event.id, trigger: 'post_event' })
      .catch(err => console.error(`Post-event trigger failed for ${event.id}:`, err))
  }
}
