import { prisma } from '@/lib/prisma'
import { DEFAULT_FINANCE_ITEMS, CACHE_MUSICO_CATEGORY } from '@/lib/financas'
import { Prisma } from '@/lib/generated/prisma/client'

export async function getOrCreateEventFinance(eventId: string) {
  const existing = await prisma.eventFinance.findUnique({
    where: { event_id: eventId },
    include: { items: { orderBy: { created_at: 'asc' } } },
  })
  if (existing) return existing

  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })

  try {
    return await prisma.eventFinance.create({
      data: {
        band_id:          event.band_id,
        event_id:         eventId,
        name:             event.client_name,
        client:           event.client_name,
        event_date:       event.event_date,
        expected_revenue: event.value,
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
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Corrida concorrente: outra chamada já criou o registro (ex.: duas abas,
      // refetch-on-focus) — lê o que foi criado em vez de propagar o erro.
      return prisma.eventFinance.findUniqueOrThrow({
        where: { event_id: eventId },
        include: { items: { orderBy: { created_at: 'asc' } } },
      })
    }
    throw err
  }
}

function musicianLabel(instrument: string | null, userName: string | null): string {
  const base = instrument ?? 'Músico'
  return userName ? `${base} — ${userName}` : base
}

/** Cria/atualiza a linha de custo `cache_musico` vinculada a um EventMusician,
 *  ou a remove se o cachê foi zerado (e ainda não estiver paga). */
export async function syncMusicianCost(eventMusicianId: string): Promise<void> {
  const em = await prisma.eventMusician.findUniqueOrThrow({
    where: { id: eventMusicianId },
    include: {
      user: { select: { name: true } },
      event: { select: { id: true } },
    },
  })

  const existingItem = await prisma.eventFinanceItem.findFirst({
    where: { event_musician_id: eventMusicianId },
  })

  if (em.cache_value === null) {
    if (existingItem && !existingItem.paid) {
      await prisma.eventFinanceItem.delete({ where: { id: existingItem.id } })
    }
    return
  }

  const label = musicianLabel(em.instrument, em.user?.name ?? null)

  if (existingItem) {
    await prisma.eventFinanceItem.update({
      where: { id: existingItem.id },
      data: { label, amount: em.cache_value },
    })
    return
  }

  const finance = await getOrCreateEventFinance(em.event.id)
  await prisma.eventFinanceItem.create({
    data: {
      finance_id:         finance.id,
      category:           CACHE_MUSICO_CATEGORY,
      label,
      amount:             em.cache_value,
      paid:               false,
      event_musician_id:  eventMusicianId,
    },
  })
}

/** Remove a linha de custo vinculada a um músico. Retorna `blocked: true` sem
 *  apagar nada se a linha já estiver paga e `force` não for passado. */
export async function removeMusicianCost(
  eventMusicianId: string,
  force = false
): Promise<{ blocked: boolean }> {
  const item = await prisma.eventFinanceItem.findFirst({
    where: { event_musician_id: eventMusicianId },
  })
  if (!item) return { blocked: false }
  if (item.paid && !force) return { blocked: true }

  await prisma.eventFinanceItem.delete({ where: { id: item.id } })
  return { blocked: false }
}
