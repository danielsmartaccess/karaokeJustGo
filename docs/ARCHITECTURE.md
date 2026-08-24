# ARCHITECTURE — Just Go Karaoke

## Visão geral

```
 PARTICIPANTE (PWA)   HOST (PWA)   TELÃO (Web)
        \                |               /
         \               |              /
          \______________|_____________/
                         │
                      SUPABASE
          ┌──────────────┼──────────────┐
       PostgreSQL     Realtime         Auth
                    (Presence +
                     Broadcast)
```

Um único app React (Vite SPA) serve as três experiências via rotas, compartilhando domínio,
tipos e cliente Supabase. Mais simples que três apps separados e adequado ao MVP.

## Camadas

| Camada       | Pasta            | Responsabilidade                                        |
| ------------ | ---------------- | ------------------------------------------------------- |
| **UI**       | `src/ui`, `src/app` | Componentes e telas. Sem regra de negócio no JSX.    |
| **Domínio**  | `src/domain`     | ⭐ Regras puras e testáveis. Sem React, sem I/O.        |
| **Dados**    | `src/data`       | Repositories Supabase, realtime, presence (FASE 2+).    |
| **Lib**      | `src/lib`        | Cliente Supabase, utilitários.                          |

**Regra de ouro da arquitetura:** fórmulas de voto, XP, fama, ranking e transições de estado
vivem no domínio como funções puras. Componentes React apenas as consomem.

## Domínio implementado (FASE 1)

- **`performance/state-machine.ts`** — máquina de estados da apresentação
  `QUEUED → CALLED → PERFORMING → VOTING → RESULT → COMPLETED` (+ `CANCELLED`). Transições
  inválidas são bloqueadas explicitamente.
- **`voting/rules.ts`** — elegibilidade (sem auto-voto, sem duplicado, só presentes, janela de
  60s), validação de notas (1–5) e cálculo agregado de resultado (médias, % "eu cantaria
  junto", Nota da Plateia).
- **`gamification/xp.ts`** — tabela de XP **configurável** (defaults da seção 25).

## Domínio implementado (FASE 3)

- **`session/state-machine.ts`** — máquina de estados da sessão
  `SCHEDULED → OPEN → LIVE → CLOSED`, com encerramento antecipado permitido de qualquer
  estado não terminal (o host pode fechar sem passar por LIVE).

## Dados implementados (FASE 3)

- **`data/identity.ts`** — sessão anônima (Supabase Auth), upsert de profile, resolução do
  venue padrão por slug (`VITE_DEFAULT_VENUE_SLUG`, nunca hardcode o id).
- **`data/sessions.ts`** — CRUD de sessões e transições de estado (usa o domínio acima para
  validar antes de escrever no banco — a UI nunca chama `update` diretamente).

## Dados implementados (FASE 4)

- **`data/songs.ts`** — busca (`ilike` em título/artista, sanitizada antes de interpolar no
  filtro PostgREST), favoritos (toggle otimista na UI, revertido se a chamada falhar).

## Dados implementados (FASE 5)

- **`data/performances.ts`** — a fila é `performances` com `status = QUEUED`, ordenada por
  `created_at` (FIFO). Reaproveita `domain/performance/state-machine.ts` (escrito na FASE 1)
  para validar `QUEUED → CANCELLED` no cliente antes de chamar o banco — o banco valida de
  novo via trigger (`validate_performance_transition`), que hoje só libera essa mesma
  transição; as demais (`CALLED`, `PERFORMING`, `VOTING`, `RESULT`, `COMPLETED`) chegam nas
  FASES 6/7 e vão exigir estender essa função.
- **`lib/active-session.ts`** — sessão ativa do participante (id + code) persistida em
  `localStorage`, compartilhada entre `JoinPage`, `SongsPage` e `QueuePage`.

## Estados da sessão

```
SCHEDULED → OPEN → LIVE → CLOSED
```

## Realtime (FASE 6+)

- **Presence:** usuários online na sessão (base para elegibilidade de voto).
- **Broadcast:** eventos da experiência — `QUEUE_UPDATED`, `PERFORMANCE_STARTED/FINISHED`,
  `VOTING_STARTED/FINISHED`, `RESULT_AVAILABLE`, `RANKING_UPDATED`, `BADGE_EARNED`,
  `WINNER_ANNOUNCED`. Sem polling agressivo.

## Multi-tenancy

`tenant_id` / `venue_id` nas entidades relevantes + RLS. Isolamento entre tenants garantido no
banco, não só na aplicação.

## Decisões (ADR resumido)

- **Vite SPA único** em vez de multi-app → simplicidade no MVP.
- **Tailwind v4 + `@tailwindcss/vite`** → config mínima, tokens via `@theme`.
- **React Router com `basename = BASE_URL`** → funciona sob o subcaminho do GitHub Pages.
- **Validação de voto no backend** (RLS/Edge Function) → frontend nunca é a fonte de verdade
  para regras sensíveis.
