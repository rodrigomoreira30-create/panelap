import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  // 1. Parse body (return 400 if invalid JSON)
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 2. Validate payload shape — ZapSign sends:
  //    { token: string, status: string, ... }
  //    We only care about: token (doc token) and status
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('token' in payload) ||
    typeof (payload as any).token !== 'string'
  ) {
    return NextResponse.json({ ok: true }) // ignore unknown shapes gracefully
  }

  const docToken = (payload as { token: string; status?: string }).token
  const status = (payload as { token: string; status?: string }).status

  // 3. Find contract by zapsign_doc_id
  const contract = await prisma.contract.findFirst({
    where: { zapsign_doc_id: docToken },
  })

  // 4. If not found, return 200 (ZapSign may send events for unknown docs)
  if (!contract) {
    return NextResponse.json({ ok: true })
  }

  // 5. If status is 'signed', update contract:
  //    status: 'signed', signed_at: new Date()
  if (status === 'signed') {
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'signed',
        signed_at: new Date(),
      },
    })
    // 6. Emit internal event
    const { eventBus } = await import('@/lib/events/internal-bus')
    eventBus.emit('contract.signed', { contract_id: contract.id })
  }

  return NextResponse.json({ ok: true })
}
