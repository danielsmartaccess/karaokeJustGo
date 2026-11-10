-- =============================================================================
-- Comandas — funções do CLIENTE (sem login)
--
-- O cliente não tem conta. Ao abrir a comanda ele recebe, UMA vez, um segredo
-- aleatório que fica no aparelho; o banco guarda só o hash. Toda leitura ou
-- ação do cliente exige o par (comanda, segredo). Segredo errado e comanda
-- inexistente dão a mesma resposta ('not-found'), para não revelar nada.
--
-- Erros são códigos curtos em `message` (ex.: 'phone-already-open'); o app os
-- traduz. Aditiva: só cria funções novas.
-- =============================================================================

-- Abre a comanda do dia. NUNCA devolve uma comanda existente: se o celular já tem
-- comanda hoje, recusa (a recuperação passa pelo garçom).
create function public.comanda_open_tab(
  p_name  text,
  p_phone text,
  p_table text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_phone  text := public.comanda_normalize_phone(p_phone);
  v_table  text := left(nullif(btrim(coalesce(p_table, '')), ''), 20);
  v_day    date := public.comanda_service_day(now());
  v_id     uuid := gen_random_uuid();
  v_code   integer;
  v_secret text;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'invalid-name' using errcode = 'P0001';
  end if;
  if v_phone is null then
    raise exception 'invalid-phone' using errcode = 'P0001';
  end if;

  -- Serializa as aberturas do dia: o número curto e o teto não correm em paralelo.
  perform pg_advisory_xact_lock(hashtextextended('comanda-day-' || v_day::text, 0));

  if (select count(*) from public.comanda_tabs where service_day = v_day) >= 500 then
    raise exception 'daily-cap' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.comanda_tabs
     where service_day = v_day and phone = v_phone and status <> 'anulada'
  ) then
    raise exception 'phone-already-open' using errcode = 'P0001';
  end if;

  select coalesce(max(code), 0) + 1 into v_code
    from public.comanda_tabs where service_day = v_day;

  v_secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.comanda_tabs (
    id, code, service_day, customer_name, phone, phone_last4, phone_status,
    table_label, opened_by, secret_hash
  ) values (
    v_id, v_code, v_day, v_name, v_phone, right(v_phone, 4), 'informado',
    v_table, 'cliente', encode(sha256(convert_to(v_secret, 'UTF8')), 'hex')
  );

  insert into public.comanda_tab_events (tab_id, kind) values (v_id, 'opened_by_client');

  return jsonb_build_object('tab_id', v_id, 'code', v_code, 'secret', v_secret);
end;
$$;

-- Valida o segredo e devolve a linha da comanda; senão 'not-found'.
create function public.comanda_tab_for_secret(p_tab_id uuid, p_secret text)
returns public.comanda_tabs
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tab public.comanda_tabs;
begin
  select * into v_tab from public.comanda_tabs where id = p_tab_id;
  if not found
     or v_tab.secret_hash is null
     or v_tab.secret_hash <> encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
  then
    raise exception 'not-found' using errcode = 'P0001';
  end if;
  return v_tab;
end;
$$;

-- A comanda do cliente: situação, consumo e total (parcial até o fechamento).
create function public.comanda_get_my_tab(p_tab_id uuid, p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tab public.comanda_tabs := public.comanda_tab_for_secret(p_tab_id, p_secret);
begin
  return jsonb_build_object(
    'tab', jsonb_build_object(
      'id', v_tab.id,
      'code', v_tab.code,
      'customer_name', v_tab.customer_name,
      'table_label', v_tab.table_label,
      'phone_status', v_tab.phone_status,
      'status', v_tab.status,
      'service_day', v_tab.service_day,
      'bill_requested_at', v_tab.bill_requested_at,
      'closed_at', v_tab.closed_at,
      -- Conta final, congelada pelo gerente. Só existe com status = 'fechada'.
      'closed_total_cents', case when v_tab.status = 'fechada' then v_tab.closed_total_cents end
    )
  ) || public.comanda_summary(v_tab.id);
end;
$$;

-- O cliente pede a conta. Idempotente: pedir de novo não muda nada.
create function public.comanda_request_bill(p_tab_id uuid, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.comanda_tabs := public.comanda_tab_for_secret(p_tab_id, p_secret);
begin
  if v_tab.status in ('fechada', 'anulada') then
    raise exception 'tab-closed' using errcode = 'P0001';
  end if;
  if v_tab.status = 'aberta' then
    update public.comanda_tabs
       set status = 'conta_pedida', bill_requested_at = now()
     where id = v_tab.id;
    insert into public.comanda_tab_events (tab_id, kind) values (v_tab.id, 'bill_requested_by_client');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Permissões: só estas três ficam abertas ao público (anon e logados).
revoke execute on function
  public.comanda_open_tab(text, text, text),
  public.comanda_tab_for_secret(uuid, text),
  public.comanda_get_my_tab(uuid, text),
  public.comanda_request_bill(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.comanda_open_tab(text, text, text),
  public.comanda_get_my_tab(uuid, text),
  public.comanda_request_bill(uuid, text)
to anon, authenticated;
