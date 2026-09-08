-- Novos sinais efêmeros de sessão para o redesign Host/Telão:
-- CTA broadcast (host chama o público), override de exibição (ranking sob demanda)
-- e comando remoto de playback (play/pause do vídeo no telão).
-- Texto livre + check constraint em vez de enum novo: são sinais extensíveis,
-- não estados de domínio permanentes.

alter table public.sessions
  add column cta_message text,
  add column cta_triggered_at timestamptz,
  add column display_override text,
  add column playback_command text,
  add column playback_command_at timestamptz;

alter table public.sessions
  add constraint sessions_cta_message_check
    check (cta_message is null or cta_message in ('qr', 'pedido', 'vote', 'next', 'celebrate'));

alter table public.sessions
  add constraint sessions_display_override_check
    check (display_override is null or display_override in ('RANKING'));

alter table public.sessions
  add constraint sessions_playback_command_check
    check (playback_command is null or playback_command in ('PLAY', 'PAUSE'));

-- O telão é anônimo e hoje só enxerga sessions/performances públicas (OPEN/LIVE/CLOSED).
-- Ele precisa também contar participantes ao vivo para o estado de lobby do redesign;
-- a policy de SELECT existente de session_participants é restrita a si mesmo/staff.
-- Policy adicional (permissiva, soma com a existente via OR) espelha exatamente
-- o mesmo critério de "sessão pública" já usado em sessions/performances.
create policy "session participant counts are publicly readable for open sessions"
  on public.session_participants
  for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_participants.session_id
        and s.status in ('OPEN', 'LIVE', 'CLOSED')
    )
  );
