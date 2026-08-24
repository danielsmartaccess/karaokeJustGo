-- FASE 5: fila
-- "A fila" é `performances` filtradas por status = QUEUED, ordenadas por created_at
-- (FIFO) — não existe tabela `queue_entries` separada: a máquina de estados de
-- apresentação (src/domain/performance/state-machine.ts, já escrita na FASE 1) já
-- trata QUEUED como o primeiro estado do ciclo de vida da apresentação.
-- Esta migration só habilita QUEUED → CANCELLED (entrar/sair da fila). As demais
-- transições (CALLED, PERFORMING, VOTING, RESULT, COMPLETED) chegam nas FASES 6/7 —
-- ver validate_performance_transition() abaixo, que precisará ser estendida lá.

create type public.performance_status as enum (
  'QUEUED', 'CALLED', 'PERFORMING', 'VOTING', 'RESULT', 'COMPLETED', 'CANCELLED'
);

create table public.performances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  song_id uuid not null references public.songs (id),
  performer_id uuid not null references public.profiles (id),
  status public.performance_status not null default 'QUEUED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um participante só pode ter UMA apresentação ativa na fila por sessão por vez
-- (evita monopolizar a fila). Índice parcial: não afeta status já finalizados.
create unique index performances_one_queued_per_performer
  on public.performances (session_id, performer_id)
  where status = 'QUEUED';

create index performances_session_id_idx on public.performances (session_id);
create index performances_status_idx on public.performances (status);

create trigger performances_set_updated_at
  before update on public.performances
  for each row execute function public.set_updated_at();

-- Fonte de verdade das transições permitidas no servidor (docs/SECURITY.md: nunca
-- confiar só no frontend). Espelha src/domain/performance/state-machine.ts.
create or replace function public.validate_performance_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'QUEUED' and new.status = 'CANCELLED' then
    return new;
  end if;
  raise exception 'Transição de apresentação inválida: % → % (FASE 5 só libera QUEUED → CANCELLED)',
    old.status, new.status;
end;
$$;

create trigger performances_validate_transition
  before update on public.performances
  for each row execute function public.validate_performance_transition();

alter table public.performances enable row level security;

create policy "performances are readable in open/live sessions or by venue staff"
  on public.performances for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = performances.session_id
        and (
          s.status in ('OPEN', 'LIVE')
          or exists (
            select 1 from public.venue_staff vs
            where vs.venue_id = s.venue_id and vs.profile_id = auth.uid()
          )
        )
    )
  );

create policy "participants can queue themselves in open/live sessions"
  on public.performances for insert
  with check (
    performer_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = performances.session_id and s.status in ('OPEN', 'LIVE')
    )
  );

create policy "performer or venue staff can update a performance"
  on public.performances for update
  using (
    performer_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      join public.venue_staff vs on vs.venue_id = s.venue_id
      where s.id = performances.session_id and vs.profile_id = auth.uid()
    )
  )
  with check (
    performer_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      join public.venue_staff vs on vs.venue_id = s.venue_id
      where s.id = performances.session_id and vs.profile_id = auth.uid()
    )
  );

-- `profiles` é restrito ao dono (FASE 2). A fila precisa mostrar o nome de QUEM está
-- cantando para os outros participantes — projeção pública segura, sem WhatsApp
-- (dado de contato privado, nunca exposto a outros participantes).
create view public.public_profiles
with (security_invoker = false) as
select id, display_name, avatar_url
from public.profiles;

grant select on public.public_profiles to anon, authenticated;
