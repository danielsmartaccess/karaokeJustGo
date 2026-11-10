-- =============================================================================
-- Comandas — funções da EQUIPE (garçom e gerente)
--
-- Exigem usuário autenticado (e-mail e senha, NÃO anônimo) presente em
-- comanda_staff com active = true. O garçom vê só o final do celular e só as
-- comandas de hoje; o gerente vê o número inteiro (migration seguinte).
-- Aditiva: só cria funções novas.
-- =============================================================================

-- Quem sou eu? Chamável por qualquer logado; devolve se já estou cadastrado e ativo.
create function public.comanda_whoami()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.comanda_staff;
begin
  if auth.uid() is null then
    return jsonb_build_object('registered', false);
  end if;
  select * into v_row from public.comanda_staff where user_id = auth.uid();
  if not found then
    return jsonb_build_object('registered', false);
  end if;
  return jsonb_build_object(
    'registered', true, 'name', v_row.name, 'role', v_row.role, 'active', v_row.active);
end;
$$;

-- Autocadastro da equipe: entra PENDENTE como garçom; só um gerente ativa. Quem
-- entrou com login anônimo não pode se cadastrar. O primeiro gerente é definido
-- pelo dono, direto no banco (ver docs/COMANDAS.md).
create function public.comanda_register_staff(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'invalid-name' using errcode = 'P0001';
  end if;
  insert into public.comanda_staff (user_id, name) values (v_uid, v_name)
    on conflict (user_id) do nothing;
  return public.comanda_whoami();
end;
$$;

-- Cardápio da equipe: itens vivos (aprovados e sugeridos), com preço.
create function public.comanda_menu()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'name', c.name, 'category', c.category,
             'price_cents', c.price_cents, 'status', c.status, 'use_count', c.use_count)
           order by c.use_count desc, c.name)
      from public.comanda_catalog c
     where c.status <> 'archived' and c.merged_into is null), '[]'::jsonb);
end;
$$;

-- Busca de comandas de HOJE por número, 4 últimos dígitos ou nome. Sem telefone
-- completo, no máximo 10, nunca de outro dia, nunca anuladas.
create function public.comanda_find_tabs(p_query text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q      text := btrim(coalesce(p_query, ''));
  v_digits text := regexp_replace(v_q, '\D', '', 'g');
  v_name   text := public.comanda_normalize(v_q);
  v_day    date := public.comanda_service_day(now());
begin
  perform public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  return coalesce((
    select jsonb_agg(r) from (
      select jsonb_build_object(
               'id', t.id, 'code', t.code, 'customer_name', t.customer_name,
               'phone_last4', t.phone_last4, 'phone_status', t.phone_status,
               'table_label', t.table_label, 'status', t.status) as r
        from public.comanda_tabs t
       where t.service_day = v_day
         and t.status <> 'anulada'
         and (
           v_q = ''
           or (v_digits <> '' and t.code::text = v_digits)
           or (length(v_digits) = 4 and t.phone_last4 = v_digits)
           or (v_name <> '' and position(v_name in public.comanda_normalize(t.customer_name)) > 0)
         )
       order by t.code desc
       limit 10
    ) q), '[]'::jsonb);
end;
$$;

-- Detalhe da comanda: situação, consumo e lançamentos (com o saldo de cada linha).
-- O garçom só abre comandas de hoje e vê o final do celular; o gerente vê tudo.
create function public.comanda_get_tab(p_tab_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  v_role public.comanda_staff_role;
  v_tab  public.comanda_tabs;
begin
  select role into v_role from public.comanda_staff where user_id = v_uid;
  select * into v_tab from public.comanda_tabs where id = p_tab_id;
  if not found
     or (v_role = 'garcom'
         and (v_tab.service_day <> public.comanda_service_day(now()) or v_tab.status = 'anulada'))
  then
    raise exception 'not-found' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'tab', jsonb_build_object(
      'id', v_tab.id, 'code', v_tab.code, 'customer_name', v_tab.customer_name,
      'phone_last4', v_tab.phone_last4, 'phone_status', v_tab.phone_status,
      'table_label', v_tab.table_label, 'status', v_tab.status,
      'service_day', v_tab.service_day, 'opened_at', v_tab.opened_at,
      'bill_requested_at', v_tab.bill_requested_at, 'closed_at', v_tab.closed_at,
      'closed_total_cents', v_tab.closed_total_cents,
      'payment_method', v_tab.payment_method)
      || case when v_role = 'gerente'
              then jsonb_build_object('phone', v_tab.phone)
              else '{}'::jsonb end,
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'name', i.name_snapshot, 'qty', i.qty,
               'unit_price_cents', i.unit_price_cents,
               'reverses_item_id', i.reverses_item_id,
               'remaining', case when i.qty > 0
                 then i.qty + coalesce((select sum(r.qty) from public.comanda_items r
                                         where r.reverses_item_id = i.id), 0)
                 else 0 end,
               'created_at', i.created_at,
               'added_by', s.name) order by i.created_at desc, i.id)
        from public.comanda_items i
        join public.comanda_staff s on s.user_id = i.added_by
       where i.tab_id = v_tab.id), '[]'::jsonb)
  ) || public.comanda_summary(v_tab.id);
end;
$$;

-- Contingência: o garçom abre a comanda só com nome e mesa (cliente sem celular).
create function public.comanda_open_tab_by_staff(p_name text, p_table text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  v_name  text := btrim(coalesce(p_name, ''));
  v_table text := left(nullif(btrim(coalesce(p_table, '')), ''), 20);
  v_day   date := public.comanda_service_day(now());
  v_id    uuid := gen_random_uuid();
  v_code  integer;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'invalid-name' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comanda-day-' || v_day::text, 0));
  if (select count(*) from public.comanda_tabs where service_day = v_day) >= 500 then
    raise exception 'daily-cap' using errcode = 'P0001';
  end if;
  select coalesce(max(code), 0) + 1 into v_code
    from public.comanda_tabs where service_day = v_day;

  insert into public.comanda_tabs (
    id, code, service_day, customer_name, phone_status, table_label, opened_by)
  values (v_id, v_code, v_day, v_name, 'sem_celular', v_table, 'garcom');
  insert into public.comanda_tab_events (tab_id, kind, staff_id) values (v_id, 'opened_by_staff', v_uid);

  return jsonb_build_object('tab_id', v_id, 'code', v_code);
end;
$$;

-- O garçom confirma, na mesa, o celular que o cliente informou.
create function public.comanda_confirm_phone(p_tab_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  v_done integer;
begin
  update public.comanda_tabs
     set phone_status = 'confirmado'
   where id = p_tab_id
     and phone is not null
     and phone_status = 'informado'
     and status <> 'anulada'
     and service_day = public.comanda_service_day(now());
  get diagnostics v_done = row_count;
  if v_done = 1 then
    insert into public.comanda_tab_events (tab_id, kind, staff_id) values (p_tab_id, 'phone_confirmed', v_uid);
  end if;
  return jsonb_build_object('ok', v_done = 1);
end;
$$;

-- Lança um item. Por id do catálogo ou por texto digitado; texto que não existe
-- vira uma SUGESTÃO já utilizável por todos (o gerente decide depois). Grava o
-- preço da hora. Só em comanda de hoje, aberta ou com a conta pedida.
create function public.comanda_add_item(
  p_tab_id          uuid,
  p_catalog_item_id uuid default null,
  p_name            text default null,
  p_qty             integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  v_tab     public.comanda_tabs;
  v_target  public.comanda_catalog;
  v_name    text;
  v_norm    text;
  v_created boolean := false;
  v_item_id uuid := gen_random_uuid();
begin
  -- Trava a comanda: lançar e fechar a conta não correm em paralelo.
  select * into v_tab from public.comanda_tabs where id = p_tab_id for update;
  if not found then
    raise exception 'tab-not-found' using errcode = 'P0001';
  end if;
  if v_tab.status not in ('aberta', 'conta_pedida')
     or v_tab.service_day <> public.comanda_service_day(now()) then
    raise exception 'tab-not-open-today' using errcode = 'P0001';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 99 then
    raise exception 'invalid-qty' using errcode = 'P0001';
  end if;

  if p_catalog_item_id is not null then
    select t.* into v_target
      from public.comanda_catalog c
      join public.comanda_catalog t on t.id = coalesce(c.merged_into, c.id)
     where c.id = p_catalog_item_id;
  end if;

  if v_target.id is null then
    v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
    if char_length(v_name) < 1 or char_length(v_name) > 80 then
      raise exception 'empty-name' using errcode = 'P0001';
    end if;
    v_norm := public.comanda_normalize(v_name);
    select * into v_target from public.comanda_catalog
     where normalized = v_norm and status <> 'archived' and merged_into is null;
    if not found then
      insert into public.comanda_catalog (name, normalized, category, status)
      values (v_name, v_norm, 'Outros', 'suggested')
      on conflict (normalized) where status <> 'archived' and merged_into is null do nothing;
      select * into v_target from public.comanda_catalog
       where normalized = v_norm and status <> 'archived' and merged_into is null;
      v_created := true;
    end if;
  end if;

  update public.comanda_catalog
     set use_count = use_count + p_qty, last_used_at = now()
   where id = v_target.id;

  insert into public.comanda_items (
    id, tab_id, catalog_item_id, name_snapshot, qty, unit_price_cents, added_by)
  values (v_item_id, v_tab.id, v_target.id, v_target.name, p_qty, v_target.price_cents, v_uid);

  return jsonb_build_object('item_id', v_item_id, 'name', v_target.name, 'created', v_created);
end;
$$;

-- Estorno (parcial ou total): nova linha negativa; a original nunca muda.
create function public.comanda_reverse_item(p_item_id uuid, p_qty integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  v_item   public.comanda_items;
  v_tab    public.comanda_tabs;
  v_left   integer;
  v_amount integer;
begin
  select * into v_item from public.comanda_items where id = p_item_id;
  if not found or v_item.qty <= 0 then
    return jsonb_build_object('ok', false);
  end if;

  -- Trava a comanda e confere a situação dela.
  select * into v_tab from public.comanda_tabs where id = v_item.tab_id for update;
  if v_tab.status not in ('aberta', 'conta_pedida')
     or v_tab.service_day <> public.comanda_service_day(now()) then
    raise exception 'tab-not-open-today' using errcode = 'P0001';
  end if;

  v_left := v_item.qty + coalesce((
    select sum(r.qty) from public.comanda_items r where r.reverses_item_id = v_item.id), 0);
  v_amount := coalesce(p_qty, v_left);
  if v_left <= 0 or v_amount < 1 or v_amount > v_left then
    return jsonb_build_object('ok', false);
  end if;

  insert into public.comanda_items (
    tab_id, catalog_item_id, name_snapshot, qty, unit_price_cents, reverses_item_id, added_by)
  values (v_item.tab_id, v_item.catalog_item_id, v_item.name_snapshot, -v_amount,
          v_item.unit_price_cents, v_item.id, v_uid);
  return jsonb_build_object('ok', true);
end;
$$;

-- O garçom registra que a mesa pediu a conta (o cliente avisou de viva voz).
create function public.comanda_request_bill_by_staff(p_tab_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  v_tab public.comanda_tabs;
begin
  select * into v_tab from public.comanda_tabs where id = p_tab_id for update;
  if not found or v_tab.service_day <> public.comanda_service_day(now()) then
    raise exception 'not-found' using errcode = 'P0001';
  end if;
  if v_tab.status in ('fechada', 'anulada') then
    raise exception 'tab-closed' using errcode = 'P0001';
  end if;
  if v_tab.status = 'aberta' then
    update public.comanda_tabs
       set status = 'conta_pedida', bill_requested_at = now() where id = v_tab.id;
    insert into public.comanda_tab_events (tab_id, kind, staff_id)
    values (v_tab.id, 'bill_requested_by_staff', v_uid);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Recuperação de acesso: o cliente trocou de aparelho ou perdeu o segredo. Gera um
-- segredo NOVO (o antigo deixa de valer) para o garçom entregar ao cliente.
create function public.comanda_reissue_secret(p_tab_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  v_tab    public.comanda_tabs;
  v_secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  select * into v_tab from public.comanda_tabs where id = p_tab_id for update;
  if not found
     or v_tab.service_day <> public.comanda_service_day(now())
     or v_tab.status in ('fechada', 'anulada')
     or v_tab.phone is null then
    raise exception 'not-found' using errcode = 'P0001';
  end if;
  update public.comanda_tabs
     set secret_hash = encode(sha256(convert_to(v_secret, 'UTF8')), 'hex')
   where id = v_tab.id;
  insert into public.comanda_tab_events (tab_id, kind, staff_id)
  values (v_tab.id, 'secret_reissued', v_uid);
  return jsonb_build_object('tab_id', v_tab.id, 'secret', v_secret);
end;
$$;

-- Permissões: só usuários logados (a função confere o papel por dentro).
revoke execute on function
  public.comanda_whoami(),
  public.comanda_register_staff(text),
  public.comanda_menu(),
  public.comanda_find_tabs(text),
  public.comanda_get_tab(uuid),
  public.comanda_open_tab_by_staff(text, text),
  public.comanda_confirm_phone(uuid),
  public.comanda_add_item(uuid, uuid, text, integer),
  public.comanda_reverse_item(uuid, integer),
  public.comanda_request_bill_by_staff(uuid),
  public.comanda_reissue_secret(uuid)
from public, anon, authenticated;

grant execute on function
  public.comanda_whoami(),
  public.comanda_register_staff(text),
  public.comanda_menu(),
  public.comanda_find_tabs(text),
  public.comanda_get_tab(uuid),
  public.comanda_open_tab_by_staff(text, text),
  public.comanda_confirm_phone(uuid),
  public.comanda_add_item(uuid, uuid, text, integer),
  public.comanda_reverse_item(uuid, integer),
  public.comanda_request_bill_by_staff(uuid),
  public.comanda_reissue_secret(uuid)
to authenticated;
