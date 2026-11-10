-- =============================================================================
-- Comandas — funções do GERENTE
--
-- Fechamento da conta (congela o total e registra a forma de pagamento; a
-- cobrança pelo app NÃO existe ainda), reabertura, anulação, curadoria do
-- catálogo com preços, equipe e relatório de vendas. Todas exigem um gerente
-- ativo. Aditiva: só cria funções novas.
-- =============================================================================

-- Comandas de um dia (padrão: hoje), com telefone inteiro, consumo e total.
create function public.comanda_list_tabs(p_day date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day date := coalesce(p_day, public.comanda_service_day(now()));
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'id', t.id, 'code', t.code, 'customer_name', t.customer_name,
               'phone', t.phone, 'phone_status', t.phone_status,
               'table_label', t.table_label, 'status', t.status,
               'opened_at', t.opened_at, 'bill_requested_at', t.bill_requested_at,
               'closed_at', t.closed_at, 'closed_total_cents', t.closed_total_cents,
               'payment_method', t.payment_method)
             || public.comanda_summary(t.id)
             order by t.code desc)
      from public.comanda_tabs t
     where t.service_day = v_day), '[]'::jsonb);
end;
$$;

-- Fila do caixa: contas pedidas hoje, da mais antiga para a mais nova.
create function public.comanda_pending_bills()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'id', t.id, 'code', t.code, 'customer_name', t.customer_name,
               'phone_status', t.phone_status, 'table_label', t.table_label,
               'status', t.status, 'opened_at', t.opened_at,
               'bill_requested_at', t.bill_requested_at)
             || public.comanda_summary(t.id)
             order by t.bill_requested_at, t.code)
      from public.comanda_tabs t
     where t.status = 'conta_pedida'
       and t.service_day = public.comanda_service_day(now())), '[]'::jsonb);
end;
$$;

-- Fecha a conta: CONGELA o total e registra como foi paga. Recusa se há itens sem
-- preço (a conta sairia errada), a menos que o gerente aceite explicitamente.
create function public.comanda_close_tab(
  p_tab_id           uuid,
  p_payment_method   text,
  p_accept_unpriced  boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  v_tab     public.comanda_tabs;
  v_summary jsonb;
begin
  if p_payment_method is null or p_payment_method not in ('dinheiro', 'cartao', 'pix', 'outro') then
    raise exception 'invalid-payment-method' using errcode = 'P0001';
  end if;

  -- Trava a comanda: nenhum garçom lança item enquanto a conta é congelada.
  select * into v_tab from public.comanda_tabs where id = p_tab_id for update;
  if not found then
    raise exception 'not-found' using errcode = 'P0001';
  end if;
  if v_tab.status not in ('aberta', 'conta_pedida') then
    raise exception 'tab-closed' using errcode = 'P0001';
  end if;

  v_summary := public.comanda_summary(v_tab.id);
  if (v_summary ->> 'unpriced_units')::int > 0 and not coalesce(p_accept_unpriced, false) then
    raise exception 'unpriced-items' using errcode = 'P0001';
  end if;

  update public.comanda_tabs
     set status = 'fechada',
         closed_at = now(),
         closed_by = v_uid,
         closed_total_cents = (v_summary ->> 'total_cents')::int,
         closed_unpriced_units = (v_summary ->> 'unpriced_units')::int,
         payment_method = p_payment_method
   where id = v_tab.id;

  insert into public.comanda_tab_events (tab_id, kind, staff_id, detail)
  values (v_tab.id, 'closed', v_uid, jsonb_build_object(
    'total_cents', (v_summary ->> 'total_cents')::int,
    'unpriced_units', (v_summary ->> 'unpriced_units')::int,
    'payment_method', p_payment_method));

  return jsonb_build_object(
    'ok', true,
    'total_cents', (v_summary ->> 'total_cents')::int,
    'unpriced_units', (v_summary ->> 'unpriced_units')::int);
end;
$$;

-- Reabre uma conta fechada por engano. Só no mesmo dia de serviço; o total
-- congelado é descartado (o fechamento volta a ser calculado) e o evento fica
-- registrado na auditoria.
create function public.comanda_reopen_tab(p_tab_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  v_tab public.comanda_tabs;
begin
  select * into v_tab from public.comanda_tabs where id = p_tab_id for update;
  if not found then
    raise exception 'not-found' using errcode = 'P0001';
  end if;
  if v_tab.status <> 'fechada' or v_tab.service_day <> public.comanda_service_day(now()) then
    raise exception 'cannot-reopen' using errcode = 'P0001';
  end if;

  update public.comanda_tabs
     set status = 'aberta', closed_at = null, closed_by = null,
         closed_total_cents = null, closed_unpriced_units = null, payment_method = null
   where id = v_tab.id;
  insert into public.comanda_tab_events (tab_id, kind, staff_id, detail)
  values (v_tab.id, 'reopened', v_uid, jsonb_build_object('previous_total_cents', v_tab.closed_total_cents));
  return jsonb_build_object('ok', true);
end;
$$;

-- Anula uma comanda lixo sem apagá-la. Conta já fechada precisa ser reaberta antes.
create function public.comanda_void_tab(p_tab_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  v_tab public.comanda_tabs;
begin
  select * into v_tab from public.comanda_tabs where id = p_tab_id for update;
  if not found then
    raise exception 'not-found' using errcode = 'P0001';
  end if;
  if v_tab.status in ('fechada', 'anulada') then
    raise exception 'tab-closed' using errcode = 'P0001';
  end if;
  update public.comanda_tabs set status = 'anulada', voided_at = now() where id = v_tab.id;
  insert into public.comanda_tab_events (tab_id, kind, staff_id) values (v_tab.id, 'voided', v_uid);
  return jsonb_build_object('ok', true);
end;
$$;

-- --- Catálogo -----------------------------------------------------------------

-- Catálogo inteiro (inclui sugeridos e arquivados) para a tela de curadoria.
create function public.comanda_catalog_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'name', c.name, 'category', c.category,
             'price_cents', c.price_cents, 'status', c.status,
             'use_count', c.use_count, 'merged_into', c.merged_into)
           order by c.use_count desc, c.name)
      from public.comanda_catalog c), '[]'::jsonb);
end;
$$;

-- Define (ou limpa, com NULL) o preço. Vendas já lançadas com preço mantêm o da hora.
create function public.comanda_catalog_set_price(p_id uuid, p_price_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done integer;
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  if p_price_cents is not null and (p_price_cents < 0 or p_price_cents > 10000000) then
    raise exception 'invalid-price' using errcode = 'P0001';
  end if;
  update public.comanda_catalog set price_cents = p_price_cents where id = p_id;
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done = 1);
end;
$$;

create function public.comanda_catalog_approve(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done integer;
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  update public.comanda_catalog set status = 'approved' where id = p_id and merged_into is null;
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done = 1);
exception when unique_violation then
  raise exception 'name-taken' using errcode = 'P0001';
end;
$$;

create function public.comanda_catalog_rename(p_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_done integer;
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'empty-name' using errcode = 'P0001';
  end if;
  update public.comanda_catalog
     set name = v_name, normalized = public.comanda_normalize(v_name)
   where id = p_id;
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done = 1);
exception when unique_violation then
  raise exception 'name-taken' using errcode = 'P0001';
end;
$$;

create function public.comanda_catalog_archive(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done integer;
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  update public.comanda_catalog set status = 'archived' where id = p_id;
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done = 1);
end;
$$;

-- Junta uma duplicata a outro item: os totais passam a somar no destino. O destino é
-- sempre um item final (quem já apontava para a duplicata passa a apontar para ele).
create function public.comanda_catalog_merge(p_from uuid, p_into uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.comanda_catalog;
  v_target public.comanda_catalog;
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  select * into v_source from public.comanda_catalog where id = p_from for update;
  select t.* into v_target
    from public.comanda_catalog c
    join public.comanda_catalog t on t.id = coalesce(c.merged_into, c.id)
   where c.id = p_into;
  if v_source.id is null or v_target.id is null or v_target.id = v_source.id then
    return jsonb_build_object('ok', false);
  end if;

  update public.comanda_catalog set merged_into = v_target.id where merged_into = v_source.id;
  update public.comanda_catalog
     set merged_into = v_target.id, status = 'archived' where id = v_source.id;
  update public.comanda_catalog
     set use_count = use_count + v_source.use_count where id = v_target.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Cria um item já aprovado, opcionalmente com preço.
create function public.comanda_catalog_add(
  p_name        text,
  p_category    text default null,
  p_price_cents integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_norm text;
  v_id   uuid;
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'empty-name' using errcode = 'P0001';
  end if;
  if p_price_cents is not null and (p_price_cents < 0 or p_price_cents > 10000000) then
    raise exception 'invalid-price' using errcode = 'P0001';
  end if;
  v_norm := public.comanda_normalize(v_name);
  if exists (select 1 from public.comanda_catalog
              where normalized = v_norm and status <> 'archived' and merged_into is null) then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  insert into public.comanda_catalog (name, normalized, category, price_cents, status)
  values (v_name, v_norm, coalesce(nullif(left(btrim(coalesce(p_category, '')), 40), ''), 'Outros'),
          p_price_cents, 'approved')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- --- Equipe -------------------------------------------------------------------

create function public.comanda_staff_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', s.user_id, 'name', s.name, 'email', u.email,
             'role', s.role, 'active', s.active)
           order by s.active, s.name)
      from public.comanda_staff s
      join auth.users u on u.id = s.user_id), '[]'::jsonb);
end;
$$;

-- Ativa ou desativa um membro. O gerente não desativa a si mesmo (evita ficar sem gerente).
create function public.comanda_staff_set_active(p_user_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  v_done integer;
begin
  if p_user_id = v_uid and not coalesce(p_active, false) then
    raise exception 'cannot-deactivate-self' using errcode = 'P0001';
  end if;
  update public.comanda_staff
     set active = coalesce(p_active, false),
         approved_by = case when p_active then v_uid else approved_by end,
         approved_at = case when p_active then now() else approved_at end
   where user_id = p_user_id;
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done = 1);
end;
$$;

-- Promove um garçom a gerente (ou rebaixa outro gerente). Ninguém muda o próprio papel.
create function public.comanda_staff_set_role(p_user_id uuid, p_role public.comanda_staff_role)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);
  v_done integer;
begin
  if p_user_id = v_uid then
    raise exception 'cannot-change-own-role' using errcode = 'P0001';
  end if;
  update public.comanda_staff set role = p_role where user_id = p_user_id;
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done = 1);
end;
$$;

-- --- Relatório de vendas ------------------------------------------------------

-- Faturamento PARCIAL do dia: o que foi lançado, sem taxa, desconto ou cortesia.
-- Contas fechadas usam o total congelado.
create function public.comanda_sales_report(p_day date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day    date := coalesce(p_day, public.comanda_service_day(now()));
  v_result jsonb;
begin
  perform public.comanda_require_role(array['gerente']::public.comanda_staff_role[]);

  with tabs as (
    select t.id, t.status, t.closed_total_cents, public.comanda_summary(t.id) as s
      from public.comanda_tabs t
     where t.service_day = v_day and t.status <> 'anulada'
  ),
  tab_totals as (
    select (s ->> 'units')::int as units,
           (s ->> 'unpriced_units')::int as unpriced,
           case when status = 'fechada' and closed_total_cents is not null
                then closed_total_cents else (s ->> 'total_cents')::int end as total
      from tabs
  ),
  lines as (
    select l ->> 'catalog_item_id' as cid, l ->> 'name' as name,
           (l ->> 'qty')::int as qty, (l ->> 'total_cents')::int as total,
           (l ->> 'unpriced_qty')::int as unpriced
      from tabs, jsonb_array_elements(s -> 'lines') l
  ),
  by_item as (
    select cid, name, sum(qty)::int as units, sum(total)::int as revenue, sum(unpriced)::int as unpriced
      from lines group by cid, name
  ),
  agg as (
    select count(*)::int as tabs,
           coalesce(sum(units), 0)::int as units,
           coalesce(sum(total), 0)::int as revenue,
           coalesce(sum(unpriced), 0)::int as unpriced,
           count(*) filter (where total > 0)::int as tabs_with_revenue
      from tab_totals
  )
  select jsonb_build_object(
    'tabs', a.tabs,
    'units', a.units,
    'revenue_cents', a.revenue,
    'unpriced_units', a.unpriced,
    'avg_ticket_cents', case when a.tabs_with_revenue > 0
                             then round(a.revenue::numeric / a.tabs_with_revenue)::int else 0 end,
    'units_per_tab', case when a.tabs > 0 then round(a.units::numeric / a.tabs, 2) else 0 end,
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'catalog_item_id', b.cid, 'name', b.name, 'units', b.units, 'revenue_cents', b.revenue)
             order by b.units desc, b.revenue desc, b.name)
        from (select * from by_item order by units desc, revenue desc, name limit 8) b), '[]'::jsonb),
    'unpriced_items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'catalog_item_id', b.cid, 'name', b.name, 'units', b.unpriced)
             order by b.unpriced desc, b.name)
        from by_item b where b.unpriced > 0), '[]'::jsonb)
  ) into v_result
  from agg a;

  return v_result;
end;
$$;

-- Permissões: só logados (cada função confere o papel de gerente por dentro).
revoke execute on function
  public.comanda_list_tabs(date),
  public.comanda_pending_bills(),
  public.comanda_close_tab(uuid, text, boolean),
  public.comanda_reopen_tab(uuid),
  public.comanda_void_tab(uuid),
  public.comanda_catalog_list(),
  public.comanda_catalog_set_price(uuid, integer),
  public.comanda_catalog_approve(uuid),
  public.comanda_catalog_rename(uuid, text),
  public.comanda_catalog_archive(uuid),
  public.comanda_catalog_merge(uuid, uuid),
  public.comanda_catalog_add(text, text, integer),
  public.comanda_staff_list(),
  public.comanda_staff_set_active(uuid, boolean),
  public.comanda_staff_set_role(uuid, public.comanda_staff_role),
  public.comanda_sales_report(date)
from public, anon, authenticated;

grant execute on function
  public.comanda_list_tabs(date),
  public.comanda_pending_bills(),
  public.comanda_close_tab(uuid, text, boolean),
  public.comanda_reopen_tab(uuid),
  public.comanda_void_tab(uuid),
  public.comanda_catalog_list(),
  public.comanda_catalog_set_price(uuid, integer),
  public.comanda_catalog_approve(uuid),
  public.comanda_catalog_rename(uuid, text),
  public.comanda_catalog_archive(uuid),
  public.comanda_catalog_merge(uuid, uuid),
  public.comanda_catalog_add(text, text, integer),
  public.comanda_staff_list(),
  public.comanda_staff_set_active(uuid, boolean),
  public.comanda_staff_set_role(uuid, public.comanda_staff_role),
  public.comanda_sales_report(date)
to authenticated;
