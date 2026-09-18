-- =============================================================================
-- Registro de chamada do participante pelo WhatsApp
--
-- O Host chama o próximo cantor pelo WhatsApp Web. Sem persistir esse fato, o
-- botão fica idêntico depois do clique: numa casa cheia, com o Host alternando
-- entre notebook e tablet, ninguém sabe quem já foi avisado e o participante
-- recebe a mesma mensagem três vezes.
--
-- `notified_at` é carimbado quando o Host dispara a chamada, e o realtime leva
-- o estado para os outros dispositivos.
-- =============================================================================

alter table public.karaoke_queue_entries
  add column if not exists notified_at timestamptz;

comment on column public.karaoke_queue_entries.notified_at is
  'Quando o Host chamou o participante pelo WhatsApp. Null = ainda nao avisado.';
