-- FASE 10: mídia — vídeo de karaokê no telão + modo DJ
--
-- O catálogo curado (FASE 4) não escala: qualquer pedido fora do seed de 38 músicas
-- travava a fila. Trocamos por ENTRADA DE TEXTO LIVRE — o participante digita o que
-- quer cantar — e o host resolve o vídeo do YouTube em tempo real ao chamar (cola o
-- link; busca "<nome> karaokê" no YouTube fora do app). Sem YouTube Data API, sem
-- cota, sem custo, e o host confere o vídeo antes de projetar.
--
-- O mesmo vídeo alimenta duas coisas:
--   1. o player de karaokê no telão (YouTube IFrame — só precisa do video id);
--   2. o "modo DJ" do host (sessions.dj_*), pra animar a casa entre apresentações.
-- Spotify entra só como deep-link no frontend (abre no app do host) — sem schema.

-- 1. Fora: catálogo curado e favoritos por catálogo ---------------------------

-- O trigger de XP de favoritar (award_xp_on_favorite) está preso a user_favorite_songs
-- e cai no CASCADE; a função órfã é removida explicitamente. 'FAVORITE_SONG' continua
-- no enum xp_event como valor legado (Postgres não remove valor de enum sem recriar o
-- tipo) — fica sem trigger que o gere.
drop table if exists public.user_favorite_songs cascade;
drop function if exists public.award_xp_on_favorite() cascade;

-- performances.song_id (FK not null -> songs) é o que prende a fila ao catálogo.
alter table public.performances drop column song_id;

drop table if exists public.songs cascade;

-- 2. Dentro: pedido em texto livre + vídeo resolvido pelo host ----------------

alter table public.performances
  add column song_query text not null default '',
  add column youtube_video_id text,
  add column youtube_url text;

-- O default só existiu pra não quebrar linhas antigas (não há nenhuma — a rodada de
-- teste roda reset-test-round.sql antes). Daqui pra frente o INSERT sempre manda o
-- texto digitado pelo participante.
alter table public.performances alter column song_query drop default;

-- O host grava youtube_video_id/youtube_url junto com a transição CALLED → PERFORMING
-- (ou depois, ainda em CALLED/PERFORMING). Nenhuma policy nova: a policy de UPDATE
-- "performer or venue staff" já cobre staff, e validate_performance_transition() faz
-- `return new` quando o status não muda — então setar só as colunas de vídeo passa.

-- 3. Modo DJ: o que está tocando agora entre apresentações (por sessão) -------

alter table public.sessions
  add column dj_youtube_video_id text,
  add column dj_started_at timestamptz;

-- `sessions` já está na publication supabase_realtime (FASE 6) — o telão recebe a
-- mudança de dj_youtube_video_id ao vivo sem migration extra.
