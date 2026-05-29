import { NextResponse } from 'next/server'
import { triggerPreEventMessages, triggerPostEventMessages } from '@/lib/postsale/triggers'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const errors: string[] = []

  await triggerPreEventMessages().catch(err => {
    errors.push(`pre_event: ${(err as Error).message}`)
  })

  await triggerPostEventMessages().catch(err => {
    errors.push(`post_event: ${(err as Error).message}`)
  })

  return NextResponse.json({
    data: {
      executed_at: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    },
  })
}
