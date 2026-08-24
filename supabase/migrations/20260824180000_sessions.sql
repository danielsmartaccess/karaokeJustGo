-- FASE 3: sessão
-- Estados: SCHEDULED → OPEN → LIVE → CLOSED (docs/ARCHITECTURE.md).
-- Código curto (6 chars) usado no link/QR de entrada do participante.

create type public.session_status as enum ('SCHEDULED', 'OPEN', 'LIVE', 'CLOSED');

create or replace function public.generate_session_code()
returns text
language plpgsql
as $$
declare
  -- sem 0/O/1/I para evitar confusão na leitura/digitação
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  attempt int := 0;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.sessions where code = result);
    attempt := attempt + 1;
    if attempt > 20 then
      raise exception 'não foi possível gerar código único de sessão';
    end if;
  end loop;
  return result;
end;
$$;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  code text not null unique,
  title text,
  status public.session_status not null default 'SCHEDULED',
  created_by uuid not null references public.profiles (id) default auth.uid(),
  opened_at timestamptz,
  live_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_venue_id_idx on public.sessions (venue_id);
create index sessions_status_idx on public.sessions (status);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

create or replace function public.set_session_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.generate_session_code();
  end if;
  return new;
end;
$$;

create trigger sessions_set_code
  before insert on public.sessions
  for each row execute function public.set_session_code();

alter table public.sessions enable row level security;

-- Leitura pública só de sessões OPEN/LIVE — necessário para o fluxo de entrada via
-- QR/código, que acontece ANTES do participante se autenticar. Staff do venue vê tudo
-- (inclusive agendadas/encerradas) para gerenciar.
create policy "open sessions are publicly readable"
  on public.sessions for select
  using (
    status in ('OPEN', 'LIVE')
    or exists (
      select 1 from public.venue_staff
      where venue_staff.venue_id = sessions.venue_id
        and venue_staff.profile_id = auth.uid()
    )
  );

create policy "venue staff can create sessions"
  on public.sessions for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.venue_staff
      where venue_staff.venue_id = sessions.venue_id
        and venue_staff.profile_id = auth.uid()
    )
  );

create policy "venue staff can update their sessions"
  on public.sessions for update
  using (
    exists (
      select 1 from public.venue_staff
      where venue_staff.venue_id = sessions.venue_id
        and venue_staff.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.venue_staff
      where venue_staff.venue_id = sessions.venue_id
        and venue_staff.profile_id = auth.uid()
    )
  );
