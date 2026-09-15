import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

async function main() {
  const { prisma } = await import('../lib/prisma')

  try {
    const orphans = await prisma.eventFinance.findMany({
      where: { event_id: null },
      select: { id: true, name: true, client: true, event_date: true, expected_revenue: true },
      orderBy: { event_date: 'asc' },
    })

    if (orphans.length === 0) {
      console.log('OK: nenhum EventFinance sem evento vinculado. Seguro prosseguir com a migração de schema (event_id obrigatório).')
      return
    }

    console.error(
      `ATENÇÃO: ${orphans.length} registro(s) financeiro(s) sem evento vinculado encontrados.\n` +
      'Event.lead_id é obrigatório e único no schema atual — não é seguro criar eventos ' +
      'retroativos automaticamente (exigiria também criar Leads sintéticos no funil comercial).\n' +
      'Resolva manualmente (vincule a um evento existente ou decida descartar) antes de aplicar ' +
      'a migração que torna EventFinance.event_id obrigatório:'
    )
    for (const f of orphans) {
      const revenue = parseFloat(f.expected_revenue.toString())
      console.error(
        `  - ${f.id} | ${f.name} (${f.client ?? 'sem cliente'}) | ` +
        `${f.event_date.toISOString().slice(0, 10)} | R$ ${revenue.toFixed(2)}`
      )
    }
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
