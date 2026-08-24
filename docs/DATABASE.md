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

## Papéis

`PARTICIPANT` · `HOST` · `ADMIN`. Autorização aplicada via RLS, nunca apenas no frontend.

## Views / functions (quando fizer sentido)

- **Mais cantadas** (dia/mês/histórico) — via view/query agregada, não cálculo no frontend.
- **Resultado da votação** — calculado no backend (média por categoria, % "eu cantaria junto",
  Nota da Plateia).
- **Rankings** — noite / mês / hall da fama / por categoria.

> Este documento evolui junto com o schema a cada fase.
