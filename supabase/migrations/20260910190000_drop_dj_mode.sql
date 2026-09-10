-- Remove o "modo DJ" — vídeo de fundo do telão controlado pelo host entre
-- apresentações (colunas adicionadas na FASE 10, ver 20260901120000_youtube_media.sql).
--
-- Motivo: o modo DJ compartilhava o mesmo container do player do YouTube com o
-- ramo da apresentação ao vivo; alternar entre os dois travava o telão
-- (React removeChild sobre o nó que o IFrame API já havia substituído). O host
-- passa a rodar música de intervalo por fora do app (som da casa / outra aba),
-- sem chamar o próximo da fila.
--
-- Sem perda de dado real: as colunas só guardavam o vídeo tocando "agora".

alter table public.sessions
  drop column if exists dj_youtube_video_id,
  drop column if exists dj_started_at;
