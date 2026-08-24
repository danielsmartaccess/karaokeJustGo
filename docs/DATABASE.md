# DATABASE — Just Go Karaoke

> Banco: **PostgreSQL via Supabase**. Schema versionado em `supabase/migrations/` — o banco
> deve poder ser reconstruído inteiramente a partir das migrations (nada só no painel).

## Convenções

- Chaves primárias `uuid` (`gen_random_uuid()`).
- `created_at` / `updated_at` (`timestamptz`) em toda tabela; `updated_at` via trigger.
- Foreign keys, indexes e constraints explícitos.
- Row Level Security (RLS) **habilitado em todas as tabelas**.
- `tenant_id` / `venue_id` onde houver isolamento por estabelecimento.
- Clareza acima de esperteza — SQL simples e legível.

## Modelo de dados previsto

Entidades esperadas (nomenclatura a revisar antes de implementar):

| Grupo         | Tabelas                                                             |
| ------------- | ------------------------------------------------------------------ |
| Tenancy       | `tenants`, `venues`                                                 |
| Identidade    | `profiles` (liga a `auth.users`)                                    |
| Sessão        | `sessions`                                                          |
| Catálogo      | `songs`, `user_favorite_songs`                                      |
| Fila / palco  | `queue_entries`, `performances`                                     |
| Votação       | `vote_categories`, `votes`, `performance_results`                  |
| Gamificação   | `points_transactions`, `user_reputation`, `badges`, `user_badges` |
| Ranking       | `leaderboards`, `leaderboard_entries`                              |
| Premiação     | `awards`                                                            |
| Auditoria     | `audit_logs`                                                        |

## Implementado (FASE 2)

Projeto Supabase `just-go-karaoke` (região `sa-east-1`), migrations em
`supabase/migrations/`:

- **`tenants`** — dono de um ou mais venues. Leitura pública (nome do tenant não é sensível).
- **`venues`** — estabelecimento físico. Leitura pública; `unique(tenant_id, slug)`.
- **`profiles`** — 1:1 com `auth.users`, criado automaticamente via trigger
  `on_auth_user_created` no signup. Cada usuário só lê/edita o próprio registro.
- **`venue_staff`** — associa um `profile` a um `venue` com papel `HOST` ou `ADMIN`. Todo
  usuário é implicitamente `PARTICIPANT`; papéis elevados exigem linha explícita aqui (papéis
  são por venue, não globais — decisão tomada aqui, ainda não documentada como ADR).

RLS habilitada em todas as tabelas; `get_advisors` (security) sem alertas. Seed do primeiro
tenant/venue (`just-go` / `armazem-anita`) aplicado via migration própria, idempotente
(`on conflict … do nothing`) — nunca hardcoded na aplicação.

Tipos TypeScript gerados em `src/lib/database.types.ts` e plugados no cliente
(`src/lib/supabase.ts`) — regenerar após cada migration nova.

Fila, votação, gamificação, ranking, premiação e auditoria ficam para as próximas fases (ver
tabela acima).

## Implementado (FASE 3)

- **`sessions`** — `venue_id`, `code` (6 chars, gerado por trigger `sessions_set_code` /
  `generate_session_code()`, sem 0/O/1/I para evitar confusão), `status`
  (`SCHEDULED → OPEN → LIVE → CLOSED`), `created_by`, timestamps de cada transição
  (`opened_at`/`live_at`/`closed_at`).
- Leitura pública **só** de sessões `OPEN`/`LIVE` (necessária para o fluxo de entrada via
  código/QR, que acontece antes do participante se autenticar); staff do venue
  (`venue_staff`) vê todos os status. Criar/atualizar sessão exige ser staff do venue.
- Hardening pós-advisors: funções de trigger com `search_path` fixo; `handle_new_user`
  (FASE 2) teve `EXECUTE` revogado de `anon`/`authenticated` — só roda via trigger.

## Implementado (FASE 4)

- **`songs`** — catálogo curado (título, artista, gênero, idioma), sem `venue_id`: um
  catálogo de karaokê é essencialmente universal, compartilhado entre venues do mesmo
  tenant/rede. `unique(title, artist)` evita duplicatas. Índices `pg_trgm` (schema
  `extensions`, não `public` — corrigido após alerta do advisor) em `title`/`artist` para
  busca por `ilike`. Leitura pública; escrita restrita a `venue_staff` (qualquer venue).
  Seed inicial com 38 músicas (MPB, sertanejo, rock nacional, pagode, clássicos
  internacionais) só para destravar teste — catálogo real do Armazém Anita é curadoria
  futura do host, não gerado por IA.
- **`user_favorite_songs`** — `(profile_id, song_id)` como chave primária composta; cada
  usuário só vê/gerencia os próprios favoritos.

## Implementado (FASE 5)

- **`performances`** — a fila é este table filtrado por `status = QUEUED`, ordenado por
  `created_at` (FIFO); não existe `queue_entries` separada (ver ARCHITECTURE.md). Enum
  `performance_status` já tem os 7 valores completos do ciclo de vida (a máquina de estados
  já existia desde a FASE 1), mas o trigger `validate_performance_transition` só libera
  `QUEUED → CANCELLED` por enquanto — estender nas FASES 6/7. Índice único parcial
  `(session_id, performer_id) where status = 'QUEUED'` impede um participante monopolizar a
  fila com várias músicas ao mesmo tempo.
- **`public_profiles`** (view) — projeção pública de `profiles` (`id`, `display_name`,
  `avatar_url`, sem `whatsapp`) para mostrar quem está cantando/na fila para os outros
  participantes. Usa `security_invoker = false` de propósito, para contornar a RLS
  self-only de `profiles` — o advisor marca isso como ERROR (`security_definer_view`);
  revisado e aceito, porque é exatamente essa a única forma de expor nome sem expor
  WhatsApp (ver docs/SECURITY.md).

## Implementado (FASE 6)

- Trigger `validate_performance_transition` estendida: agora libera
  `QUEUED → CALLED → PERFORMING`, além de `CANCELLED` a partir de qualquer um dos três
  (espelha `CANCELLABLE` em `src/domain/performance/state-machine.ts`). `VOTING` em diante
  continua bloqueado (FASE 7).
- Autorização embutida na própria trigger: chamar (`CALLED`) e marcar cantando
  (`PERFORMING`) exige ser `venue_staff` do venue da sessão E a sessão estar
  `OPEN`/`LIVE`; cancelar pode ser o próprio performer OU staff.
- Índice único parcial `(session_id) where status in ('CALLED','PERFORMING')` — só uma
  pessoa ativa no palco por sessão por vez.
- Hardening: a policy de INSERT em `performances` não travava `status` explicitamente
  (um participante mal-intencionado podia inserir já como `CALLED`) — corrigido para
  exigir `status = 'QUEUED'` no `with check`.
- `performances` e `sessions` adicionadas à publication `supabase_realtime` — habilita
  `postgres_changes` no cliente (ver ARCHITECTURE.md).

## Implementado (FASE 7)

- **`performances`** ganha `voting_started_at` — carimbado pelo próprio trigger (nunca
  pelo cliente: é a base do cálculo da janela de 60s, então não pode ser confiável se
  vier do payload). Transições liberadas: `PERFORMING → VOTING → RESULT → COMPLETED`.
- **`session_participants`** — proxy de "presente na sessão" (docs/SECURITY.md exige
  "votante presente/online"). **Simplificação deliberada:** é "já completou o cadastro
  nesta sessão", não presença efêmera via WebSocket — Presence real exigiria uma ponte
  Realtime→Postgres (o trigger SQL não consegue ler estado de um canal Realtime, que só
  existe na memória do servidor Realtime, não no banco). Documentado como limitação
  conhecida, não descoberta tardia.
- **`votes`** — `voice_score`/`performance_score`/`charisma_score`/`fun_score` (1-5,
  `check` constraint) + `would_sing_along`. `unique(performance_id, voter_id)` impede
  voto duplicado no banco (defesa em profundidade além do trigger). RLS: cada um só lê
  o próprio voto — nunca expõe voto individual de outra pessoa (docs/PRODUCT.md).
- **`validate_vote`** (trigger) — fonte de verdade de todas as regras de
  docs/SECURITY.md: sem auto-voto, só com `status = VOTING`, dentro dos 60s
  (`voting_started_at`), só quem está em `session_participants`.
- **`performance_results`** (view, `security_invoker = false` — mesmo padrão de
  `public_profiles`) — médias por categoria, Nota da Plateia, % "cantaria junto",
  contagem de votos. Só existe porque agrega (nunca expõe uma linha de `votes`
  individualmente) — revisado e aceito no mesmo alerta ERROR do advisor.

## Implementado (FASE 8)

- **`points_transactions`** — ledger fonte de verdade (XP total = `SUM(points)`). Público
  para leitura (ao contrário de `votes`: XP é conquista social, feita pra ser celebrada —
  docs/PRODUCT.md). **Sem policy de insert/update/delete para roles de cliente** — só as
  4 triggers `SECURITY DEFINER` abaixo escrevem, cada uma reagindo a UMA ação já validada
  em outra tabela: `session_participants` (JOIN_SESSION + RETURN_VENUE se já visitou o
  venue antes), `votes` (VOTE + bônus VOTE_FIVE_PERFORMANCES no 5º voto da sessão),
  `performances` completada (SING), `user_favorite_songs` (FAVORITE_SONG). Valores fixos
  de `src/domain/gamification/xp.ts` — config de XP por venue fica para FASE 10 se for
  necessário, não construída especulativamente. **`DUET` não tem trigger** — não existe
  apresentação com 2 cantores no modelo atual.
- **`badges`** (catálogo, 4 badges seed) + **`user_badges`** (`unique(profile_id,
  badge_id)` — uma vez só). Concedidos pelas mesmas 4 triggers.
- **Sem `leaderboards`/`leaderboard_entries`**: ranking é view agregada
  (`session_reputation` por sessão, `user_reputation` geral/"hall da fama") sobre
  `points_transactions`, não tabela materializada — sem processo de snapshot para
  manter em dia (docs/DATABASE.md: "não cálculo no frontend").
- Testado ao vivo: matemática de XP conferida em 3 cenários reais (entrar + favoritar +
  cantar = 125 XP; votar = 30 XP; voltar numa 2ª sessão do mesmo venue = +120 XP e badge
  "Fiel à Casa", sem duplicar "Primeiro Passo").

## Papéis

`PARTICIPANT` · `HOST` · `ADMIN`. Autorização aplicada via RLS, nunca apenas no frontend.

## Views / functions (quando fizer sentido)

- **Mais cantadas** (dia/mês/histórico) — via view/query agregada, não cálculo no frontend.
- **Resultado da votação** — calculado no backend (média por categoria, % "eu cantaria junto",
  Nota da Plateia).
- **Rankings** — noite / mês / hall da fama / por categoria.

> Este documento evolui junto com o schema a cada fase.
