import { prisma } from '@/lib/prisma'
import { DEFAULT_FINANCE_ITEMS, CACHE_MUSICO_CATEGORY } from '@/lib/financas'
import { Prisma } from '@/lib/generated/prisma/client'

export async function getOrCreateEventFinance(eventId: string) {
  const existing = await prisma.eventFinance.findUnique({
    where: { event_id: eventId },
    include: {
      items:    { orderBy: { created_at: 'asc' } },
      payments: { orderBy: { payment_date: 'asc' } },
    },
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
      include: {
        items:    { orderBy: { created_at: 'asc' } },
        payments: { orderBy: { payment_date: 'asc' } },
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Corrida concorrente: outra chamada já criou o registro (ex.: duas abas,
      // refetch-on-focus) — lê o que foi criado em vez de propagar o erro.
      return prisma.eventFinance.findUniqueOrThrow({
        where: { event_id: eventId },
        include: {
          items:    { orderBy: { created_at: 'asc' } },
          payments: { orderBy: { payment_date: 'asc' } },
        },
      })
    }
    throw err
  }
}

function musicianLabel(instrument: string | null, userName: string | null): string {
  const base = instrument ?? 'Músico'
  return userName ? `${base} — ${userName}` : base
}

export type MusicianCostOutcome = 'created' | 'updated' | 'removed' | 'noop'

/** Garante que a atribuição da Formação tenha exatamente uma linha `cache_musico`
 *  no Financeiro do evento.
 *
 *  A Formação é a fonte da verdade:
 *  - músico/equipe atribuído COM cachê → tem linha, qualquer que seja a função e o status
 *    de confirmação (pendente, confirmado ou recusado); o valor é o cachê da Formação;
 *  - vaga aberta (sem músico) → nunca é custo de músico;
 *  - sem cachê definido → sem linha (regra existente: a aba diz "Nenhum músico com cachê
 *    definido na Formação"). Uma linha antiga ainda não paga é removida; a paga é mantida.
 *
 *  Checagem + criação rodam numa transação com lock consultivo por atribuição, para que
 *  chamadas concorrentes (duas abas, refetch, sync + reconcile) não dupliquem a linha. */
export async function syncMusicianCost(eventMusicianId: string): Promise<MusicianCostOutcome> {
  const em = await prisma.eventMusician.findUniqueOrThrow({
    where: { id: eventMusicianId },
    include: {
      user: { select: { name: true } },
      event: { select: { id: true } },
    },
  })

  const amount = em.cache_value
  if (em.user_id === null || amount === null) {
    const existing = await prisma.eventFinanceItem.findFirst({
      where: { event_musician_id: eventMusicianId },
    })
    if (existing && !existing.paid) {
      await prisma.eventFinanceItem.delete({ where: { id: existing.id } })
      return 'removed'
    }
    return 'noop'
  }

  const finance = await getOrCreateEventFinance(em.event.id)
  const label = musicianLabel(em.instrument, em.user?.name ?? null)

  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventMusicianId}))`

    const existingItem = await tx.eventFinanceItem.findFirst({
      where: { event_musician_id: eventMusicianId },
    })

    if (existingItem) {
      await tx.eventFinanceItem.update({
        where: { id: existingItem.id },
        data: { label, amount },
      })
      return 'updated' as const
    }

    await tx.eventFinanceItem.create({
      data: {
        finance_id:         finance.id,
        category:           CACHE_MUSICO_CATEGORY,
        label,
        amount,
        paid:               false,
        event_musician_id:  eventMusicianId,
      },
    })
    return 'created' as const
  })
}

/** Cura atribuições da Formação (com cachê) que ficaram sem linha no Financeiro (sync que falhou ou
 *  atribuição anterior à sincronização). Só cria o que falta: nunca sobrescreve valores
 *  existentes, então ajustes manuais no Financeiro são preservados.
 *
 *  Sem `eventId`, cobre a banda toda, mas apenas eventos que já têm registro financeiro
 *  (não cria financeiro para eventos que ainda não foram para o Financeiro).
 *  Nunca lança: uma falha aqui não deve derrubar a tela que está lendo os custos. */
export async function reconcileTeamCosts(
  scope: { bandId: string; eventId?: string }
): Promise<number> {
  let created = 0
  try {
    const missing = await prisma.eventMusician.findMany({
      where: {
        user_id: { not: null },
        cache_value: { not: null },
        finance_items: { none: {} },
        event: {
          band_id: scope.bandId,
          ...(scope.eventId && { id: scope.eventId }),
          finance: { isNot: null },
        },
      },
      select: { id: true },
    })

    for (const { id } of missing) {
      try {
        if ((await syncMusicianCost(id)) === 'created') created++
      } catch (err) {
        console.error('[financas] Falha ao curar custo de cachê da Formação:', id, err)
      }
    }
  } catch (err) {
    console.error('[financas] Falha ao verificar equipe da Formação sem custo:', err)
  }
  return created
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
