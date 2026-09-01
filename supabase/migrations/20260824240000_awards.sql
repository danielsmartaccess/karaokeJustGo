-- FASE 9: premiação
-- Um único prêmio no MVP (docs/PRODUCT.md, roadmap): "Performance da Noite". Sem
-- categorias extras (melhor voz, mais carismático etc.) — não documentado como
-- escopo do MVP, não inventado aqui.
--
-- O vencedor é calculado DENTRO da function (maior audience_score entre as
-- apresentações COMPLETED da sessão) — o cliente nunca escolhe quem ganha, só
-- dispara o anúncio (mesmo princípio de XP: servidor decide o valor).

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  performance_id uuid not null references public.performances (id) on delete cascade,
  code text not null,
  awarded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (session_id, code)
);

create index awards_session_id_idx on public.awards (session_id);

alter table public.awards enable row level security;

create policy "awards are publicly readable"
  on public.awards for select
  using (true);

-- Sem policy de insert/update/delete para roles de cliente — só a function abaixo
-- escreve, e ela mesma checa autorização (só staff, só sessão CLOSED).

insert into public.badges (code, name, description, icon) values
  ('performance-da-noite', 'Performance da Noite', 'Teve a Nota da Plateia mais alta da noite.', '🏆');

create or replace function public.announce_performance_of_the_night(p_session_id uuid)
returns public.awards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean;
  v_session_status public.session_status;
  v_winner_id uuid;
  v_result public.awards;
begin
  select status into v_session_status from public.sessions where id = p_session_id;

  if v_session_status is null then
    raise exception 'Sessão não encontrada.';
  end if;

  select exists (
    select 1 from public.venue_staff vs
    join public.sessions s on s.venue_id = vs.venue_id
    where s.id = p_session_id and vs.profile_id = auth.uid()
  ) into v_is_staff;

  if not v_is_staff then
    raise exception 'Só staff do venue pode anunciar a Performance da Noite.';
  end if;

  if v_session_status != 'CLOSED' then
    raise exception 'Só dá para anunciar depois que a sessão for encerrada.';
  end if;

  select p.id into v_winner_id
  from public.performances p
  join public.performance_results r on r.performance_id = p.id
  where p.session_id = p_session_id and p.status = 'COMPLETED'
  order by r.audience_score desc, r.vote_count desc, p.created_at asc
  limit 1;

  if v_winner_id is null then
    raise exception 'Nenhuma apresentação com votos suficientes nesta sessão.';
  end if;

  insert into public.awards (session_id, performance_id, code, awarded_by)
  values (p_session_id, v_winner_id, 'PERFORMANCE_OF_THE_NIGHT', auth.uid())
  on conflict (session_id, code) do nothing;

  select * into v_result
  from public.awards
  where session_id = p_session_id and code = 'PERFORMANCE_OF_THE_NIGHT';

  insert into public.user_badges (profile_id, badge_id, session_id)
  select p.performer_id, b.id, p_session_id
  from public.performances p, public.badges b
  where p.id = v_result.performance_id and b.code = 'performance-da-noite'
  on conflict do nothing;

  return v_result;
end;
$$;

alter publication supabase_realtime add table public.awards;
