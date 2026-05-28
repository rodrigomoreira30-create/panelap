import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/session'
import { createZapSignDocument } from '@/lib/zapsign/client'
import { fillTemplate, buildContractData } from '@/lib/contracts/template-fill'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contract = await prisma.contract.findFirst({
    where: { id, event: { band_id: sessionUser.band_id } },
    include: { event: { include: { lead: true } }, template: true },
  })

  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { event, template } = contract
  const { lead } = event

  if (!lead) {
    return NextResponse.json(
      { error: 'Lead not found for this event' },
      { status: 422 }
    )
  }

  const filledContent = fillTemplate(template.content, buildContractData(lead))
  const base64Content = Buffer.from(filledContent).toString('base64')

  const zapDoc = await createZapSignDocument({
    name: `Contrato - ${event.client_name}`,
    content: base64Content,
    signers: [
      {
        name: lead.client_name,
        email: '',
        phone_country: '55',
        phone_number: lead.phone,
      },
    ],
  })

  const updated = await prisma.contract.update({
    where: { id },
    data: {
      zapsign_doc_id: zapDoc.token,
      zapsign_link: zapDoc.signers[0]?.sign_url ?? null,
      status: 'sent',
      reviewed_by: sessionUser.id,
    },
  })

  return NextResponse.json({ data: updated })
}
