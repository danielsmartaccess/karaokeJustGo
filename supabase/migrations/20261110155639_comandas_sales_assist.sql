-- =============================================================================
-- Comandas — apoio à venda do garçom
--
--   * comanda_suggest_pairings: "costuma sair junto". Cruza comandas, então só o
--     servidor pode calcular (o garçom não lê itens de outras comandas).
--   * comanda_remove_one: o "−" do cardápio. Tira UMA unidade da linha mais recente
--     que ainda tem saldo, de forma atômica.
--
-- Aditiva: só cria funções novas.
-- =============================================================================

-- Itens que, nas outras comandas, apareceram junto com o que esta já tem e que
-- esta ainda não tem. Contagem simples de coocorrência por comanda, sem modelo:
-- fácil de explicar ao bar. Comandas anuladas não contam. Devolve até p_limit
-- itens, do que mais saiu junto para o que menos saiu.
create function public.comanda_suggest_pairings(p_tab_id uuid, p_limit integer default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);

  return coalesce((
    with per_tab as (
      select i.tab_id, coalesce(c.merged_into, c.id) as cid, sum(i.qty) as q
        from public.comanda_items i
        join public.comanda_catalog c on c.id = i.catalog_item_id
        join public.comanda_tabs t on t.id = i.tab_id
       where t.status <> 'anulada'
       group by i.tab_id, coalesce(c.merged_into, c.id)
      having sum(i.qty) > 0
    ),
    mine as (select cid from per_tab where tab_id = p_tab_id),
    others as (select tab_id, cid from per_tab where tab_id <> p_tab_id),
    -- Outras comandas que têm pelo menos um item em comum com esta.
    shared_tabs as (
      select distinct o.tab_id
        from others o
       where o.cid in (select cid from mine)
    ),
    candidates as (
      select o.cid as cand, count(distinct o.tab_id)::int as tabs
        from others o
       where o.tab_id in (select tab_id from shared_tabs)
         and o.cid not in (select cid from mine)
       group by o.cid
    ),
    -- O item desta comanda que mais puxa cada candidato ("com Chopp").
    reasons as (
      select distinct on (o.cid) o.cid as cand, m.cid as because
        from others o
        join others m on m.tab_id = o.tab_id and m.cid in (select cid from mine)
       where o.cid not in (select cid from mine)
       group by o.cid, m.cid
       order by o.cid, count(*) desc, m.cid
    )
    select jsonb_agg(jsonb_build_object(
             'catalog_item_id', top.catalog_item_id,
             'name', top.name,
             'price_cents', top.price_cents,
             'because', top.because,
             'tabs', top.tabs)
           order by top.tabs desc, top.use_count desc, top.name)
      from (
        select cat.id as catalog_item_id, cat.name, cat.price_cents, cat.use_count,
               bc.name as because, c.tabs
          from candidates c
          join public.comanda_catalog cat on cat.id = c.cand
            and cat.status <> 'archived' and cat.merged_into is null
          join reasons r on r.cand = c.cand
          join public.comanda_catalog bc on bc.id = r.because
         order by c.tabs desc, cat.use_count desc, cat.name
         limit greatest(coalesce(p_limit, 3), 0)
      ) top
  ), '[]'::jsonb);
end;
$$;

-- O "−" do cardápio: tira uma unidade do item na comanda, da linha mais recente que
-- ainda tem saldo. Mesmas regras do estorno: só em comanda de hoje, aberta ou com a
-- conta pedida. Devolve {ok:false} se a comanda não tem o item.
create function public.comanda_remove_one(p_tab_id uuid, p_catalog_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := public.comanda_require_role(array['garcom', 'gerente']::public.comanda_staff_role[]);
  v_tab    public.comanda_tabs;
  v_target uuid;
  v_line   public.comanda_items;
begin
  select * into v_tab from public.comanda_tabs where id = p_tab_id for update;
  if not found then
    raise exception 'tab-not-found' using errcode = 'P0001';
  end if;
  if v_tab.status not in ('aberta', 'conta_pedida')
     or v_tab.service_day <> public.comanda_service_day(now()) then
    raise exception 'tab-not-open-today' using errcode = 'P0001';
  end if;

  select coalesce(c.merged_into, c.id) into v_target
    from public.comanda_catalog c where c.id = p_catalog_item_id;
  if v_target is null then
    return jsonb_build_object('ok', false);
  end if;

  select i.* into v_line
    from public.comanda_items i
    join public.comanda_catalog c on c.id = i.catalog_item_id
   where i.tab_id = p_tab_id
     and i.qty > 0
     and coalesce(c.merged_into, c.id) = v_target
     and i.qty + coalesce((select sum(r.qty) from public.comanda_items r
                            where r.reverses_item_id = i.id), 0) > 0
   order by i.created_at desc, i.id desc
   limit 1;
  if v_line.id is null then
    return jsonb_build_object('ok', false);
  end if;

  insert into public.comanda_items (
    tab_id, catalog_item_id, name_snapshot, qty, unit_price_cents, reverses_item_id, added_by)
  values (v_line.tab_id, v_line.catalog_item_id, v_line.name_snapshot, -1,
          v_line.unit_price_cents, v_line.id, v_uid);
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function
  public.comanda_suggest_pairings(uuid, integer),
  public.comanda_remove_one(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.comanda_suggest_pairings(uuid, integer),
  public.comanda_remove_one(uuid, uuid)
to authenticated;
