-- FASE 7: votação
-- Libera PERFORMING → VOTING → RESULT → COMPLETED. Adiciona session_participants
-- (proxy de "presente na sessão" — sem Presence efêmero via WebSocket, que exigiria
-- uma ponte Realtime→Postgres fora de escopo aqui; ver docs/SECURITY.md) e votes
-- (regras de docs/SECURITY.md: sem auto-voto, sem duplicado, só presentes, só na
-- janela de 60s, nota 1-5). performance_results é view agregada — nunca expõe voto
-- individual (docs/PRODUCT.md).

alter table public.performances add column voting_started_at timestamptz;

-- "Presente na sessão" = já completou o cadastro/entrou nela (session_participants).
-- Não é presença efêmera em tempo real — simplificação deliberada e documentada.
create table public.session_participants (
  session_id uuid not null references public.sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

alter table public.session_participants enable row level security;

create policy "participants can record their own session membership"
  on public.session_participants for insert
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.sessions s where s.id = session_id and s.status in ('OPEN', 'LIVE'))
  );

create policy "participants and venue staff can see membership"
  on public.session_participants for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      join public.venue_staff vs on vs.venue_id = s.venue_id
      where s.id = session_participants.session_id and vs.profile_id = auth.uid()
    )
  );

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references public.performances (id) on delete cascade,
  voter_id uuid not null references public.profiles (id),
  voice_score smallint not null check (voice_score between 1 and 5),
  performance_score smallint not null check (performance_score between 1 and 5),
  charisma_score smallint not null check (charisma_score between 1 and 5),
  fun_score smallint not null check (fun_score between 1 and 5),
  would_sing_along boolean not null,
  created_at timestamptz not null default now(),
  unique (performance_id, voter_id)
);

create index votes_performance_id_idx on public.votes (performance_id);

alter table public.votes enable row level security;

create policy "voters can see their own vote"
  on public.votes for select
  using (voter_id = auth.uid());

create policy "voters can cast their own vote"
  on public.votes for insert
  with check (voter_id = auth.uid());

-- Fonte de verdade das regras de elegibilidade (docs/SECURITY.md) — espelha
-- checkEligibility em src/domain/voting/rules.ts, mas é o servidor quem decide.
create or replace function public.validate_vote()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  perf record;
begin
  if new.voter_id != auth.uid() then
    raise exception 'voter_id deve ser o usuário autenticado.';
  end if;

  select p.status, p.performer_id, p.session_id, p.voting_started_at
  into perf
  from public.performances p
  where p.id = new.performance_id;

  if perf.status is null then
    raise exception 'Apresentação não encontrada.';
  end if;

  if perf.status != 'VOTING' then
    raise exception 'Votação não está aberta para esta apresentação (status atual: %).', perf.status;
  end if;

  if new.voter_id = perf.performer_id then
    raise exception 'Você não pode votar na sua própria apresentação.';
  end if;

  if perf.voting_started_at is null or now() > perf.voting_started_at + interval '60 seconds' then
    raise exception 'A janela de votação (60s) já fechou.';
  end if;

  if not exists (
    select 1 from public.session_participants sp
    where sp.session_id = perf.session_id and sp.profile_id = new.voter_id
  ) then
    raise exception 'Você precisa estar na sessão para votar.';
  end if;

  return new;
end;
$$;

create trigger votes_validate
  before insert on public.votes
  for each row execute function public.validate_vote();

-- Resultado agregado — nunca expõe voto individual. security_invoker = false de
-- propósito (mesmo padrão de public_profiles na FASE 5): só assim dá para computar
-- a média de TODOS os votos, já que a RLS de `votes` restringe cada um a ver só o
-- próprio voto. O agregado em si (médias, %) não é sensível.
create view public.performance_results
with (security_invoker = false) as
select
  performance_id,
  round(avg(voice_score)::numeric, 1) as voice_avg,
  round(avg(performance_score)::numeric, 1) as performance_avg,
  round(avg(charisma_score)::numeric, 1) as charisma_avg,
  round(avg(fun_score)::numeric, 1) as fun_avg,
  round(
    (avg(voice_score) + avg(performance_score) + avg(charisma_score) + avg(fun_score)) / 4.0,
    1
  ) as audience_score,
  round(100.0 * sum(would_sing_along::int) / count(*)) as sing_along_percent,
  count(*) as vote_count
from public.votes
group by performance_id;

grant select on public.performance_results to anon, authenticated;

-- Estende as transições liberadas: PERFORMING → VOTING → RESULT → COMPLETED.
-- CANCELLED continua só até PERFORMING (docs/domain: CANCELLABLE não inclui
-- VOTING/RESULT — depois que a votação começa, não dá mais para "cancelar").
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

  if new.status = 'CANCELLED' and old.status in ('QUEUED', 'CALLED', 'PERFORMING')
     and (auth.uid() = old.performer_id or is_staff) then
    return new;
  end if;

  if old.status = 'QUEUED' and new.status = 'CALLED'
     and is_staff and session_status in ('OPEN', 'LIVE') then
    return new;
  end if;

  if old.status = 'CALLED' and new.status = 'PERFORMING'
     and is_staff and session_status in ('OPEN', 'LIVE') then
    return new;
  end if;

  if old.status = 'PERFORMING' and new.status = 'VOTING'
     and is_staff and session_status in ('OPEN', 'LIVE') then
    new.voting_started_at := now();
    return new;
  end if;

  if old.status = 'VOTING' and new.status = 'RESULT'
     and is_staff and session_status in ('OPEN', 'LIVE') then
    return new;
  end if;

  if old.status = 'RESULT' and new.status = 'COMPLETED' and is_staff then
    return new;
  end if;

  raise exception 'Transição de apresentação inválida ou não autorizada: % → %', old.status, new.status;
end;
$$;
