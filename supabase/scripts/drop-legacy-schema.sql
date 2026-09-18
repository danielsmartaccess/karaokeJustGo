-- =============================================================================
-- REMOÇÃO DO SCHEMA LEGADO — EXECUÇÃO MANUAL, DESTRUTIVA E IRREVERSÍVEL
-- =============================================================================
--
-- Contexto
-- --------
-- Até setembro de 2026 a aplicação era uma plataforma social de karaokê com
-- sessões, votação da plateia e gamificação. O produto atual é outro: uma sala
-- de karaokê com fila, telão e Host (tabelas karaoke_*). As tabelas abaixo não
-- são mais lidas nem escritas por nenhuma linha de código.
--
-- Elas NÃO foram removidas pela migration 20260918120000_karaoke_rooms.sql
-- porque guardam dados reais das noites já realizadas:
--
--   profiles              29 linhas
--   points_transactions   47 linhas
--   user_badges           34 linhas
--   session_participants  27 linhas
--   performances          23 linhas
--   votes                  7 linhas
--   venue_staff            7 linhas
--   badges                 5 linhas
--   sessions               5 linhas
--   tenants / venues       1 linha cada
--   awards                 0 linhas
--
-- ANTES DE EXECUTAR
-- -----------------
-- 1. Exporte os dados que tiverem valor histórico ou analítico.
--    O Supabase permite exportar cada tabela em CSV pelo Table Editor, ou:
--      pg_dump --data-only --table=public.performances ... > backup.sql
-- 2. Confirme que nenhum relatório, painel ou integração externa lê estas
--    tabelas.
-- 3. Rode primeiro em um branch do Supabase, não direto em produção.
--
-- Só então execute o bloco abaixo no SQL Editor do projeto.
-- =============================================================================

begin;

drop table if exists public.awards            cascade;
drop table if exists public.user_badges       cascade;
drop table if exists public.badges            cascade;
drop table if exists public.points_transactions cascade;
drop table if exists public.votes             cascade;
drop table if exists public.performances      cascade;
drop table if exists public.session_participants cascade;
drop table if exists public.sessions          cascade;
drop table if exists public.venue_staff       cascade;
drop table if exists public.venues            cascade;
drop table if exists public.tenants           cascade;
drop table if exists public.profiles          cascade;

-- Views do domínio antigo (caem com o cascade, listadas para conferência).
drop view if exists public.performance_results cascade;
drop view if exists public.public_profiles     cascade;
drop view if exists public.session_reputation  cascade;
drop view if exists public.user_reputation     cascade;

drop function if exists public.announce_performance_of_the_night(uuid) cascade;
drop function if exists public.generate_session_code() cascade;

drop type if exists public.performance_status cascade;
drop type if exists public.session_status     cascade;
drop type if exists public.staff_role         cascade;
drop type if exists public.xp_event           cascade;

commit;

-- Depois de rodar, confirme que sobraram apenas as tabelas do produto atual:
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
-- Esperado: karaoke_advertisements, karaoke_queue_entries,
--           karaoke_rooms, karaoke_screen_contents.
