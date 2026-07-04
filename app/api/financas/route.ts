import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { DEFAULT_FINANCE_ITEMS, serializeFinance } from '@/lib/financas'

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()),  10)

  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 0, 23, 59, 59)

  const finances = await prisma.eventFinance.findMany({
    where: { band_id: sessionUser.band_id, event_date: { gte: startDate, lte: endDate } },
    include: { items: { orderBy: { created_at: 'asc' } } },
    orderBy: { event_date: 'asc' },
  })

  return NextResponse.json({ data: finances.map(serializeFinance) })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { event_id, name, client, product, event_date } = body

  let finalName: string    = name ?? ''
  let finalClient: string | null  = client ?? null
  let finalDate: Date      = event_date ? new Date(event_date) : new Date()
  let finalRevenue: number = 0

  if (event_id) {
    const event = await prisma.event.findFirst({
      where: { id: event_id, band_id: sessionUser.band_id },
      include: { lead: { include: { lead_attractions: true } } },
    })
    if (!event) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

    const existingFinance = await prisma.eventFinance.findUnique({ where: { event_id } })
    if (existingFinance) return NextResponse.json({ error: 'Evento já possui registro financeiro' }, { status: 409 })

    const attractionsTotal = (event.lead?.lead_attractions ?? []).reduce(
      (s, a) => s + parseFloat(a.custom_value.toString()), 0
    )
    const discount = parseFloat((event.lead?.proposal_discount ?? 0).toString())
    finalName    = event.client_name
    finalClient  = event.client_name
    finalDate    = event.event_date
    finalRevenue = Math.max(0, attractionsTotal - discount)
  }

  if (!finalName) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 422 })

  const finance = await prisma.eventFinance.create({
    data: {
      band_id:          sessionUser.band_id,
      event_id:         event_id ?? null,
      name:             finalName,
      client:           finalClient,
      product:          product ?? null,
      event_date:       finalDate,
      expected_revenue: finalRevenue,
      received_amount:  0,
      items: {
        createMany: {
          data: DEFAULT_FINANCE_ITEMS.map(item => ({
            category: item.category,
            label:    item.label,
            amount:   0,
            paid:     false,
          })),
        },
      },
    },
    include: { items: { orderBy: { created_at: 'asc' } } },
  })

  return NextResponse.json({ data: serializeFinance(finance) }, { status: 201 })
}
