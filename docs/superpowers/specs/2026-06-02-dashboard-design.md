# Dashboard — Visão Geral do Negócio

**Data:** 2026-06-02
**Escopo:** Página inicial da banda (`/[bandSlug]`) com KPIs, gráficos de leads e próximos eventos
**Abordagem:** API endpoint único + TanStack Query (sem SSR hydration)

---

## Objetivo

Substituir o redirect atual de `/[bandSlug]` para `/[bandSlug]/comercial` por uma página de dashboard que mostra o resumo do negócio da banda: leads no funil, faturamento previsto, evolução de leads por dia e próximos eventos.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  [Leads abertos]  [Faturamento previsto]  [Leads novos] │  ← 3 KPI cards
├─────────────────────────────────────────────────────┤
│  Leads por dia (barra vertical, largura total)        │  ← gráfico largo
│  [Seletor: 7d | 30d | 90d]                           │
├──────────────────────────┬──────────────────────────┤
│  Leads por etapa          │  Próximos eventos         │  ← lado a lado
│  (barras horizontais)     │  (lista até 5 eventos)    │
└──────────────────────────┴──────────────────────────┘
```

---

## Arquitetura

### Página

`app/(dashboard)/[bandSlug]/page.tsx` — Server Component que renderiza `<DashboardClient bandSlug={bandSlug} />`. Remove o `redirect()` atual.

### API

`GET /api/dashboard?bandSlug=slug&days=30`

Autenticação via Supabase (mesmo padrão das outras rotas). Valida que o usuário pertence à banda antes de retornar dados.

Resposta:

```ts
{
  kpi: {
    leadsAbertos: number        // leads cujo status não é "closed_won" nem "closed_lost"
    faturamentoPrevisto: number // soma de Event.value onde status in ['contracted','active']
    leadsNovos: number          // leads com created_at >= hoje - days
  }
  leadsByDay: Array<{ date: string; count: number }>   // últimos N dias, sem gaps
  leadsByStage: Array<{ stage: string; count: number }> // agrupa por Lead.status
  upcomingEvents: Array<{
    id: string
    clientName: string
    eventDate: string  // ISO date string
    eventType: string
  }>                                                    // event_date >= hoje, limit 5
}
```

`leadsByDay` deve incluir todos os dias do intervalo, mesmo os com `count: 0`, para o gráfico não ter lacunas.

`leadsByStage` usa os estágios do pipeline da banda (`Band.pipeline_stages`). Se `pipeline_stages` for `null`, usa os estágios padrão: `['new_lead', 'contacted', 'proposal_sent', 'negotiation', 'closing', 'closed_won', 'closed_lost']`.

### Componentes client

| Arquivo | Responsabilidade |
|---|---|
| `components/dashboard/DashboardClient.tsx` | `useQuery(['dashboard', bandSlug, days])`, seletor de período, distribui props |
| `components/dashboard/KpiCards.tsx` | 3 cards lado a lado com número e label |
| `components/dashboard/LeadsByDayChart.tsx` | `<BarChart>` do Recharts — eixo X = data, eixo Y = count |
| `components/dashboard/LeadsByStageChart.tsx` | `<BarChart layout="vertical">` do Recharts — barras horizontais por etapa |
| `components/dashboard/UpcomingEvents.tsx` | Lista simples com data, nome do cliente e tipo de evento |

---

## Fluxo de dados

1. `page.tsx` renderiza `<DashboardClient bandSlug={bandSlug} />`
2. `DashboardClient` chama `useQuery(['dashboard', bandSlug, 30])` → `GET /api/dashboard?bandSlug=...&days=30`
3. Enquanto carrega: skeleton nos cards e gráficos
4. Dados chegam: KpiCards, LeadsByDayChart, LeadsByStageChart e UpcomingEvents recebem props
5. Usuário muda período (ex: 7 dias): `days` atualiza no state, nova query `['dashboard', bandSlug, 7]` dispara automaticamente

---

## Seletor de período

Botões: `7 dias` | `30 dias` | `90 dias`

Padrão: `30 dias`

Muda o parâmetro `days` da query — todos os dados (KPIs + gráficos) atualizam juntos.

---

## Estados

| Estado | Comportamento |
|---|---|
| Carregando | Skeleton retangular cinza no lugar dos cards e gráficos |
| Sem dados | Mensagem "Nenhum lead cadastrado ainda" / "Nenhum evento próximo" por seção |
| Erro | Mensagem de erro com botão "Tentar novamente" (`refetch()`) |

---

## Labels de etapas do pipeline

Os valores em `Lead.status` são strings livres definidas pela banda em `Band.pipeline_stages`. O gráfico usa o valor como label direto. Se `pipeline_stages` for null, usa os labels padrão mapeados:

```ts
const defaultStageLabels: Record<string, string> = {
  new_lead: 'Novo lead',
  contacted: 'Contactado',
  proposal_sent: 'Proposta enviada',
  negotiation: 'Negociação',
  closing: 'Fechamento',
  closed_won: 'Fechado (ganho)',
  closed_lost: 'Fechado (perdido)',
}
```

---

## Fora do escopo

- Gráfico de receita por mês
- Comparação com período anterior
- Filtro por membro da equipe
- Polling automático (dados do dashboard são aceitos com até 1 minuto de defasagem)
