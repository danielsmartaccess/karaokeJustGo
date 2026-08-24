-- FASE 8: gamificação (XP, badges, ranking)
-- points_transactions é o ledger fonte de verdade (XP total = SUM(points)). O CLIENTE
-- NUNCA insere aqui — só triggers SECURITY DEFINER reagindo a ações já validadas em
-- outras tabelas (docs/SECURITY.md: "XP/fama/badges atribuídos por lógica de servidor,
-- nunca por gravação direta do cliente"). Valores fixos = DEFAULT_XP_TABLE de
-- src/domain/gamification/xp.ts. Config de XP por venue fica para FASE 10 se for
-- necessário — não construída especulativamente agora.
--
-- Sem tabelas `leaderboards`/`leaderboard_entries`: ranking é view/query agregada
-- sobre points_transactions (docs/DATABASE.md: "não cálculo no frontend"), não uma
-- tabela materializada que precisaria de um processo de snapshot.
--
-- DUET (evento do domínio) fica sem trigger — não existe apresentação com 2 cantores
-- no modelo atual (performances tem 1 performer_id). Documentado, não esquecido.

create type public.xp_event as enum (
  'JOIN_SESSION', 'SING', 'VOTE', 'VOTE_FIVE_PERFORMANCES', 'FAVORITE_SONG',
  'RETURN_VENUE', 'DUET'
);

create table public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  event public.xp_event not null,
  points integer not null,
  created_at timestamptz not null default now()
);

create index points_transactions_profile_id_idx on public.points_transactions (profile_id);
create index points_transactions_session_id_idx on public.points_transactions (session_id);

alter table public.points_transactions enable row level security;

-- Público de propósito: XP é conquista social, feita para ser celebrada
-- (docs/PRODUCT.md) — ao contrário de `votes` (nota individual em outra pessoa, que
-- É sensível e fica privada). Sem policy de insert/update/delete para roles de
-- cliente: só as triggers SECURITY DEFINER abaixo escrevem aqui.
create policy "points transactions are publicly readable"
  on public.points_transactions for select
  using (true);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon text not null,
  created_at timestamptz not null default now()
);

alter table public.badges enable row level security;

create policy "badges are publicly readable"
  on public.badges for select
  using (true);

create table public.user_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  earned_at timestamptz not null default now(),
  primary key (profile_id, badge_id)
);

alter table public.user_badges enable row level security;

create policy "user badges are publicly readable"
  on public.user_badges for select
  using (true);

insert into public.badges (code, name, description, icon) values
  ('primeiro-passo', 'Primeiro Passo', 'Entrou na primeira sessão Just Go.', '🎉'),
  ('estreou-no-palco', 'Estreou no Palco', 'Completou a primeira apresentação.', '🎤'),
  ('voz-ativa', 'Voz Ativa', 'Votou em 5 apresentações na mesma noite.', '🗳️'),
  ('fiel-a-casa', 'Fiel à Casa', 'Voltou para uma nova noite no mesmo venue.', '🏠');

-- ---------------------------------------------------------------------------
-- Ranking — views agregadas (não tabela materializada). session_reputation é por
-- sessão (ranking da noite); user_reputation é geral (hall da fama).
-- ---------------------------------------------------------------------------
create view public.session_reputation as
select
  pt.session_id,
  pt.profile_id,
  pp.display_name,
  sum(pt.points) as session_xp
from public.points_transactions pt
join public.public_profiles pp on pp.id = pt.profile_id
where pt.session_id is not null
group by pt.session_id, pt.profile_id, pp.display_name;

create view public.user_reputation as
select
  pt.profile_id,
  pp.display_name,
  sum(pt.points) as total_xp,
  count(*) as event_count
from public.points_transactions pt
join public.public_profiles pp on pp.id = pt.profile_id
group by pt.profile_id, pp.display_name;

-- ---------------------------------------------------------------------------
-- Triggers de premiação — cada uma reage a UMA ação já validada em outra tabela.
-- SECURITY DEFINER: o profile que disparou a ação (ex.: o próprio votante) não tem
-- permissão de escrita em points_transactions/user_badges — a trigger roda como
-- dono da tabela para poder gravar, mas os valores são sempre fixos, nunca vindos
-- de fora.
-- ---------------------------------------------------------------------------

create or replace function public.award_xp_on_session_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_returning boolean;
  v_first_ever boolean;
begin
  insert into public.points_transactions (profile_id, session_id, event, points)
  values (new.profile_id, new.session_id, 'JOIN_SESSION', 20);

  select not exists (
    select 1 from public.session_participants sp
    where sp.profile_id = new.profile_id and sp.session_id != new.session_id
  ) into v_first_ever;

  if v_first_ever then
    insert into public.user_badges (profile_id, badge_id, session_id)
    select new.profile_id, b.id, new.session_id
    from public.badges b where b.code = 'primeiro-passo'
    on conflict do nothing;
  end if;

  select venue_id into v_venue_id from public.sessions where id = new.session_id;

  select exists (
    select 1
    from public.session_participants sp
    join public.sessions s on s.id = sp.session_id
    where sp.profile_id = new.profile_id
      and sp.session_id != new.session_id
      and s.venue_id = v_venue_id
  ) into v_returning;

  if v_returning then
    insert into public.points_transactions (profile_id, session_id, event, points)
    values (new.profile_id, new.session_id, 'RETURN_VENUE', 100);

    insert into public.user_badges (profile_id, badge_id, session_id)
    select new.profile_id, b.id, new.session_id
    from public.badges b where b.code = 'fiel-a-casa'
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger session_participants_award_xp
  after insert on public.session_participants
  for each row execute function public.award_xp_on_session_join();

create or replace function public.award_xp_on_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_vote_count int;
begin
  select session_id into v_session_id from public.performances where id = new.performance_id;

  insert into public.points_transactions (profile_id, session_id, event, points)
  values (new.voter_id, v_session_id, 'VOTE', 10);

  select count(*) into v_vote_count
  from public.votes v
  join public.performances p on p.id = v.performance_id
  where v.voter_id = new.voter_id and p.session_id = v_session_id;

  if v_vote_count = 5 then
    insert into public.points_transactions (profile_id, session_id, event, points)
    values (new.voter_id, v_session_id, 'VOTE_FIVE_PERFORMANCES', 50);

    insert into public.user_badges (profile_id, badge_id, session_id)
    select new.voter_id, b.id, v_session_id
    from public.badges b where b.code = 'voz-ativa'
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger votes_award_xp
  after insert on public.votes
  for each row execute function public.award_xp_on_vote();

create or replace function public.award_xp_on_performance_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_ever boolean;
begin
  if new.status != 'COMPLETED' or old.status = 'COMPLETED' then
    return new;
  end if;

  insert into public.points_transactions (profile_id, session_id, event, points)
  values (new.performer_id, new.session_id, 'SING', 100);

  select not exists (
    select 1 from public.performances p
    where p.performer_id = new.performer_id and p.status = 'COMPLETED' and p.id != new.id
  ) into v_first_ever;

  if v_first_ever then
    insert into public.user_badges (profile_id, badge_id, session_id)
    select new.performer_id, b.id, new.session_id
    from public.badges b where b.code = 'estreou-no-palco'
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger performances_award_xp
  after update on public.performances
  for each row execute function public.award_xp_on_performance_completed();

create or replace function public.award_xp_on_favorite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.points_transactions (profile_id, session_id, event, points)
  values (new.profile_id, null, 'FAVORITE_SONG', 5);
  return new;
end;
$$;

create trigger user_favorite_songs_award_xp
  after insert on public.user_favorite_songs
  for each row execute function public.award_xp_on_favorite();

alter publication supabase_realtime add table public.points_transactions;
