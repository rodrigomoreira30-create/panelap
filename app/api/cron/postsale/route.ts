import { NextResponse } from 'next/server'
import { triggerPreEventMessages, triggerPostEventMessages } from '@/lib/postsale/triggers'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const errors: string[] = []

  await triggerPreEventMessages().catch(err => {
    errors.push(`pre_event: ${err instanceof Error ? err.message : String(err)}`)
  })

  await triggerPostEventMessages().catch(err => {
    errors.push(`post_event: ${err instanceof Error ? err.message : String(err)}`)
  })

  return NextResponse.json({
    data: {
      executed_at: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    },
  })
}
