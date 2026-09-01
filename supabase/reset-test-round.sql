-- reset-test-round.sql
-- NÃO é uma migration (não entra em supabase/migrations/). É um utilitário para
-- zerar o ciclo de uma rodada de teste ao vivo sem perder dados de catálogo/identidade.
--
-- Apaga (via CASCADE a partir de `sessions`): sessions, performances, votes,
-- session_participants, points_transactions (XP), user_badges, awards.
--
-- Preserva: tenants, venues, profiles, venue_staff (papéis HOST/ADMIN), badges
-- (catálogo). Não há mais catálogo de músicas desde a FASE 10 — o pedido é texto
-- livre na própria linha de `performances` (some no truncate junto com a sessão).
--
-- Uso: rodar antes de cada nova rodada de teste manual (docs/TESTING.md).

truncate table public.sessions cascade;
