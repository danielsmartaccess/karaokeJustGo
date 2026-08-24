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

## Dados implementados (FASE 7)

- **`data/votes.ts`** — `submitVote`, `getMyVote`, `getResults`. Usa `isValidVote` de
  `domain/voting/rules.ts` (escrito na FASE 1) para validar o payload antes de enviar —
  mas quem decide de verdade é o trigger `validate_vote` no servidor.
- **`data/performances.ts`** ganha `getVotingPerformance` — deliberadamente separada de
  `getCurrentPerformance` (CALLED/PERFORMING): as duas coexistem, porque o host pode
  chamar o próximo cantor enquanto a votação do anterior ainda está rolando. `startVoting`,
  `finishVoting`, `completePerformance` fecham o ciclo QUEUED→…→COMPLETED.
- **`data/sessions.ts`** ganha `recordSessionParticipation` — grava que o profile entrou
  na sessão (`session_participants`), chamado no fim do fluxo de `/join`.
- Encerramento automático da janela de 60s: `HostPage` arma um `setTimeout` client-side
  que chama `finishVoting` quando o tempo acaba — funciona enquanto a aba do host estiver
  aberta (é quem está rodando a sessão). Sem cron/Edge Function.

## Dados implementados (FASE 8)

- **`data/gamification.ts`** — só leitura: `getMyReputation`, `getMyBadges`,
  `getSessionLeaderboard`. XP nunca é escrito pelo cliente (docs/SECURITY.md) — quem
  grava são 4 triggers `SECURITY DEFINER` no banco, cada uma reagindo a UMA ação já
  validada em outra tabela (entrar na sessão, apresentação completada, voto, favoritar).
  Nenhuma tela de app "dá" XP diretamente — só reflete o que o servidor já decidiu.
- Ranking é view agregada (`session_reputation`, `user_reputation`), não tabela
  materializada — sem processo de snapshot para manter em dia.
- `ProfilePage` (`/profile`) e a seção "Ranking da noite" do telão assinam
  `points_transactions` via Realtime — testado ao vivo: XP e badges aparecem
  corretamente sem reload, matemática conferida em 3 cenários (entrar+favoritar+cantar,
  votar, e voltar numa segunda sessão do mesmo venue).

## Dados implementados (FASE 6)

- **`data/performances.ts`** ganhou `callNext`, `markPerforming` e
  `subscribeToPerformances` (Realtime `postgres_changes`, filtrado por `session_id`).
  Realtime chegou nesta fase como estava planejado (ver "Realtime" abaixo) — `HostPage`,
  `QueuePage` e a nova `DisplayPage` (telão) assinam mudanças em `performances` e
  atualizam a UI sem polling e sem o usuário recarregar a página (testado ao vivo).
- Autorização de quem pode chamar/marcar cantando (só staff do venue, só com sessão
  aberta) vive na trigger `validate_performance_transition` — a mesma função da FASE 5,
  estendida — não em RLS pura, porque RLS não distingue "qual transição" está sendo
  tentada, só "a linha é minha".

## Estados da sessão

```
SCHEDULED → OPEN → LIVE → CLOSED
```

## Realtime

- **`postgres_changes`** (✅ FASE 6) — `HostPage`, `QueuePage` e `DisplayPage` assinam
  mudanças em `performances`/`sessions` via `data/performances.ts#subscribeToPerformances`.
  Simples e direto: reage a mudança de linha, sem precisar orquestrar eventos customizados.
- **Presence** (FASE 7) — usuários online na sessão, base para elegibilidade de voto
  (`isPresent` em `src/domain/voting/rules.ts`).
- **Broadcast** (FASE 8+) — eventos customizados de nível "experiência" —
  `RESULT_AVAILABLE`, `RANKING_UPDATED`, `BADGE_EARNED`, `WINNER_ANNOUNCED` — quando fizer
  sentido além do que `postgres_changes` já cobre. Sem polling agressivo em nenhum caso.

## Multi-tenancy

`tenant_id` / `venue_id` nas entidades relevantes + RLS. Isolamento entre tenants garantido no
banco, não só na aplicação.

## Decisões (ADR resumido)

- **Vite SPA único** em vez de multi-app → simplicidade no MVP.
- **Tailwind v4 + `@tailwindcss/vite`** → config mínima, tokens via `@theme`.
- **React Router com `basename = BASE_URL`** → funciona sob o subcaminho do GitHub Pages.
- **Validação de voto no backend** (RLS/Edge Function) → frontend nunca é a fonte de verdade
  para regras sensíveis.
