-- FASE 6: apresentação (mobile + telão + host)
-- Libera QUEUED → CALLED → PERFORMING (+ CANCELLED de qualquer um desses três) e
-- habilita Realtime em performances/sessions (docs/ARCHITECTURE.md: "Realtime FASE 6+").
-- VOTING em diante continua bloqueado — isso é FASE 7.

-- Hardening que ficou faltando na FASE 5: o INSERT não travava `status`, então um
-- participante mal-intencionado poderia inserir já como CALLED, pulando a fila.
alter policy "participants can queue themselves in open/live sessions"
  on public.performances
  with check (
    performer_id = auth.uid()
    and status = 'QUEUED'
    and exists (
      select 1 from public.sessions s
      where s.id = performances.session_id and s.status in ('OPEN', 'LIVE')
    )
  );

-- Só uma pessoa CALLED/PERFORMING por sessão por vez.
create unique index performances_one_active_performer_per_session
  on public.performances (session_id)
  where status in ('CALLED', 'PERFORMING');

-- Transições + AUTORIZAÇÃO (quem pode fazer o quê) vivem aqui — fonte única de
-- verdade no servidor (docs/SECURITY.md).
create or replace function public.validate_performance_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_staff boolean;
  session_status public.session_status;
begin
  if new.status = old.status then
    return new;
  end if;

  select s.status,
    exists (
      select 1 from public.venue_staff vs
      where vs.venue_id = s.venue_id and vs.profile_id = auth.uid()
    )
  into session_status, is_staff
  from public.sessions s
  where s.id = new.session_id;

  -- Cancelar: o próprio performer OU staff do venue, a partir de qualquer estado
  -- não-terminal (espelha CANCELLABLE em src/domain/performance/state-machine.ts).
  if new.status = 'CANCELLED' and old.status in ('QUEUED', 'CALLED', 'PERFORMING')
     and (auth.uid() = old.performer_id or is_staff) then
    return new;
  end if;

  -- Chamar / marcar "cantando agora": só staff, só com a sessão aberta/ao vivo.
  if old.status = 'QUEUED' and new.status = 'CALLED'
     and is_staff and session_status in ('OPEN', 'LIVE') then
    return new;
  end if;

  if old.status = 'CALLED' and new.status = 'PERFORMING'
     and is_staff and session_status in ('OPEN', 'LIVE') then
    return new;
  end if;

  raise exception 'Transição de apresentação inválida ou não autorizada: % → % (FASE 6 vai só até PERFORMING; VOTING em diante é FASE 7)',
    old.status, new.status;
end;
$$;

alter publication supabase_realtime add table public.performances;
alter publication supabase_realtime add table public.sessions;
