-- ============================================================
-- Just Go Karaoke - conceder acesso de STAFF (HOST/ADMIN) no /host e no telao
-- Tenant: Just Go Smart Access  .  Venue: Armazem Anita (slug: armazem-anita)
--
-- Onde rodar: Supabase -> SQL Editor. O editor roda como `postgres` e ignora
-- RLS, entao o INSERT em venue_staff (que nao tem policy de INSERT) funciona.
-- Idempotente: pode rodar de novo sem duplicar (upsert pela unique venue+profile).
-- ============================================================

do $$
declare
  -- ID mostrado na tela "Sem permissao de host" do app (= auth.uid() do dispositivo)
  v_profile_id uuid := 'e411ce60-14c5-4c86-be14-e2e728c9cb20';
  -- 'ADMIN' = gerencia tudo (inclusive outros staff)  |  'HOST' = so conduz a sessao
  v_role       public.staff_role := 'ADMIN';
  v_venue_id   uuid;
begin
  -- 1) Resolve o venue pelo slug (nunca hardcode o id - docs/PRODUCT.md)
  select id into v_venue_id from public.venues where slug = 'armazem-anita';
  if v_venue_id is null then
    raise exception 'Venue "armazem-anita" nao encontrado - rode a migration de seed antes.';
  end if;

  -- 2) Garante o profile (criado por trigger no 1o acesso ao app).
  if not exists (select 1 from public.profiles where id = v_profile_id) then
    if exists (select 1 from auth.users where id = v_profile_id) then
      insert into public.profiles (id, display_name)
      values (v_profile_id, 'Host')
      on conflict (id) do nothing;
    else
      raise exception
        'Profile % nao existe e nao ha auth.users correspondente. Abra o app uma vez nesse navegador/dispositivo e rode de novo.',
        v_profile_id;
    end if;
  end if;

  -- 3) Concede o papel (upsert pela unique (venue_id, profile_id))
  insert into public.venue_staff (venue_id, profile_id, role)
  values (v_venue_id, v_profile_id, v_role)
  on conflict (venue_id, profile_id) do update set role = excluded.role;

  raise notice 'OK: profile % agora e % no venue % (armazem-anita).', v_profile_id, v_role, v_venue_id;
end $$;

-- 4) Conferencia
select vs.role,
       vs.created_at,
       p.display_name,
       v.slug as venue_slug,
       v.name as venue_name
from public.venue_staff vs
join public.venues   v on v.id = vs.venue_id
join public.profiles p on p.id = vs.profile_id
where vs.profile_id = 'e411ce60-14c5-4c86-be14-e2e728c9cb20';

-- ------------------------------------------------------------
-- Para REVOGAR o acesso depois:
-- delete from public.venue_staff
-- where profile_id = 'e411ce60-14c5-4c86-be14-e2e728c9cb20'
--   and venue_id = (select id from public.venues where slug = 'armazem-anita');
-- ------------------------------------------------------------
