# Configurações — seções recolhíveis (accordion)

Data: 2026-09-16

## Problema

A página de Configurações (`app/(dashboard)/[bandSlug]/configuracoes/page.tsx`) renderiza todas as seções (Assinatura, Membros da Banda, Etapas do Pipeline, Fontes de Lead, Atrações Disponíveis) abertas simultaneamente, em coluna única, sem nenhum agrupamento visual (`<section><h2>` + espaçamento vertical). Conforme a banda cresce (mais membros, mais etapas, mais fontes), a página fica excessivamente longa e difícil de navegar.

## Objetivo

Transformar cada seção em um card compacto e recolhível (accordion), mostrando título + contagem no cabeçalho fechado, mantendo identidade visual, tipografia, cores, sidebar e padrão de componentes já existentes. Sem alterar funcionalidades, banco de dados, permissões, regras de negócio ou integrações — é uma reforma de UX/UI e organização.

## Escopo confirmado com o usuário

- Drag-and-drop de Etapas/Fontes: **mantém a implementação HTML5 nativa atual** (não migra para dnd-kit).
- **Atrações Disponíveis** (seção existente, não citada no pedido original) recebe o mesmo tratamento de accordion.
- **Pipeline e Fontes de Lead continuam como componentes separados** (não serão unificados em um componente genérico) — só as constantes de default são compartilhadas (ver abaixo).
- Estado inicial: **todas as seções fechadas** ao carregar a página. Sem persistência entre navegações (sem localStorage).

## Arquitetura

### `components/configuracoes/SettingsSection.tsx` (novo, client component)

Componente genérico que substitui o padrão atual `<section><h2>`. Props:

```ts
type SettingsSectionProps = {
  title: string;
  description: string; // ex: "9 membros", "Resumo do plano atual"
  defaultOpen?: boolean; // default false
  children: React.ReactNode;
};
```

Comportamento:

- Envolve o conteúdo em `Card` (`components/ui/card.tsx`) — hoje nenhuma seção de Configurações usa esse componente (usam `div` com `border rounded-lg` manual); trocar por `Card` padroniza visualmente sem mudar cores, já que os tokens do `Card` (`bg-card`, `border`) renderizam igual ao estilo atual em light mode.
- Cabeçalho é um `<button>` full-width (`CardHeader` clicável): título (`font-semibold`) + descrição (`text-sm text-muted-foreground`) à esquerda, `ChevronDown` (lucide-react) à direita, com `transition-transform duration-200` e `rotate-180` quando aberto.
- Estado `open` é local (`useState(defaultOpen)`) — cada instância é independente, permitindo múltiplas seções abertas ao mesmo tempo (desktop e mobile).
- Animação de abrir/fechar via CSS puro, sem nova dependência: wrapper com `grid-template-rows: 0fr` (fechado) → `1fr` (aberto), `transition: grid-template-rows 200ms ease`, filho direto com `overflow-hidden` (técnica de "CSS grid accordion"). **O conteúdo nunca é desmontado** — isso preserva automaticamente qualquer estado de edição não salva (formulário de membro aberto, etapa sendo renomeada, etc.) ao alternar entre seções, sem precisar de lógica extra de "preservar estado".
- Padding responsivo: `px-4 sm:px-5` no cabeçalho e no conteúdo.

### `lib/settings-defaults.ts` (novo)

Extrai `DEFAULT_STAGES` e `DEFAULT_SOURCES`, hoje hardcoded dentro de `PipelineSettings.tsx` e `SourceSettings.tsx` respectivamente, para um módulo compartilhado. Motivo: `page.tsx` (Server Component) precisa da mesma lógica de fallback para calcular a contagem exibida no cabeçalho fechado ("6 etapas", "5 fontes") sem duplicar os arrays. `PipelineSettings.tsx` e `SourceSettings.tsx` passam a importar de lá em vez de declarar localmente — nenhuma mudança de comportamento, só remove duplicação de constantes (os dois componentes continuam com lógica própria e separada, conforme decidido).

### `app/(dashboard)/[bandSlug]/configuracoes/page.tsx`

- Continua Server Component, mesmas queries (`Promise.all` com membros, dados da banda, atrações).
- Calcula as contagens de cada seção usando os dados já buscados (aplicando o fallback de `lib/settings-defaults.ts` para stages/sources quando a banda não configurou ainda).
- Troca cada `<section><h2>...` por `<SettingsSection title="..." description="...">...</SettingsSection>`, mantendo os componentes filhos (`SubscriptionStatus`, `MemberList`+`AddMember`, `PipelineSettings`, `SourceSettings`, `AttractionSettings`) exatamente como são hoje, sem mudança de props além do wrapper.
- Container passa de `max-w-2xl` para `max-w-2xl md:max-w-3xl` (mais espaço em desktop, mantendo a mesma largura em mobile). Espaçamento entre cards vira `space-y-3` (cards compactos ficam mais próximos que as seções antigas em `space-y-8`).

Textos de descrição por seção:

| Seção | Descrição no cabeçalho fechado |
|---|---|
| Assinatura | "Resumo do plano atual" (texto fixo) |
| Membros da Banda | `${members.length} membros` |
| Etapas do Pipeline | `${stageCount} etapas` |
| Fontes de Lead | `${sourceCount} fontes` |
| Atrações Disponíveis | `${attractions.length} atrações cadastradas` |

## Membros da Banda

Dentro do `SettingsSection`, o conteúdo (`MemberList` + `AddMember`) ganha:

1. Botão "+ Adicionar membro" (mecânica atual de `AddMember` — toggle de formulário inline) permanece fixo no topo do conteúdo, **fora** da área com scroll.
2. Campo de busca (filtro client-side por nome/email, `useState` + `.filter()`) aparece condicionalmente apenas quando `members.length > 8`. Usa o padrão visual de input de busca já existente em `components/comercial/KanbanBoard.tsx` (ícone `Search` posicionado absolutamente, botão `X` para limpar).
3. Lista de membros (`divide-y` como hoje): quando `members.length > 5`, o container recebe `max-h-80 overflow-y-auto`; abaixo disso, altura natural sem scroll.
4. Nenhuma mudança nos dados exibidos por linha (avatar/inicial, nome, email, badge de role) nem nas ações (remover com `confirm()` + toast).

## Etapas do Pipeline / Fontes de Lead

Lógica interna de cada componente (edição inline via `Input`, drag-and-drop HTML5 nativo, exclusão com mínimo de 1 item, `PATCH` ao salvar) **não muda**. Only o wrapper visual:

- A lista de itens ganha `max-h-72 overflow-y-auto` quando ultrapassar ~6 itens.
- Botão "Adicionar etapa"/"Adicionar fonte" e o botão "Salvar etapas"/"Salvar fontes" ficam fora da área de scroll (sempre visíveis, não somem atrás do scroll interno).

## Atrações Disponíveis

Mesmo tratamento de `SettingsSection` com contagem no cabeçalho. Lista ganha `max-h-72 overflow-y-auto` acima de ~6 itens. Edição inline, toggle ativo/inativo, exclusão e "Nova atração" continuam exatamente como hoje.

## Responsividade

- `SettingsSection`: padding `px-4 sm:px-5`.
- Grids fixos em `grid-cols-2` nos formulários inline (`AddMember.tsx`, form de nova atração em `AttractionSettings.tsx`) passam a `grid-cols-1 sm:grid-cols-2`, evitando espremer campos em telas estreitas (único ajuste funcional fora do escopo estrito do accordion, necessário para manter a página "totalmente responsiva" como pedido).
- Nenhuma mudança em `components/ui/*` compartilhados fora do reuso do `Card` já existente.

## Fora de escopo (explicitamente)

- Migração de drag-and-drop para dnd-kit.
- Unificação de `PipelineSettings`/`SourceSettings` em um componente genérico.
- Normalização de cores hardcoded (gray/blue/green/red/indigo) para tokens semânticos do tema.
- Qualquer mudança em rotas de API, schema Prisma, regras de permissão ou lógica de negócio.
- Persistência de qual seção está aberta (localStorage) entre navegações.

## Testes / verificação

- Verificação manual em navegador (dev server): abrir/fechar cada seção, confirmar animação suave, confirmar que editar um formulário em uma seção e abrir outra não perde o estado do primeiro.
- Testar responsividade em larguras mobile (~375px), tablet (~768px) e desktop.
- Confirmar que contagens no cabeçalho batem com os dados reais (inclusive fallback de defaults quando banda não configurou stages/sources).
- Rodar `npm run build`/typecheck para garantir que a extração de `lib/settings-defaults.ts` não quebra tipos.
