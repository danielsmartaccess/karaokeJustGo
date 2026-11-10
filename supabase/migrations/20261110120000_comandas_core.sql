-- =============================================================================
-- Comandas — núcleo: tipos, tabelas, trancas e funções internas
--
-- ADITIVA: não altera nenhuma tabela, política ou função existente (karaokê e
-- legado ficam intactos). Todos os objetos novos têm o prefixo `comanda_`.
--
-- Postura de acesso (diferente do karaokê, que é aberto para `anon`):
--   * RLS ligado em todas as tabelas e NENHUMA política criada.
--   * Nenhum privilégio de tabela para `anon`/`authenticated`.
--   * Todo acesso passa por funções SECURITY DEFINER (migrations seguintes), que
--     validam o papel da equipe ou o segredo da comanda.
-- Resultado: a chave pública (anon) não lê nem escreve nada diretamente.
--
-- O desenho completo está em docs/COMANDAS.md; as regras espelham
-- src/comandas/rules.ts e são testadas em tests/db/ (PGlite, sem Docker).
-- =============================================================================

-- --- Tipos -------------------------------------------------------------------

create type public.comanda_staff_role as enum ('garcom', 'gerente');

create type public.comanda_tab_status as enum (
  'aberta',        -- aceita itens
  'conta_pedida',  -- o cliente (ou o garçom) pediu a conta; ainda aceita itens
  'fechada',       -- conta congelada pelo gerente; não aceita itens
  'anulada'        -- comanda lixo; não conta em nada
);

create type public.comanda_phone_status as enum ('informado', 'confirmado', 'sem_celular');

create type public.comanda_catalog_status as enum ('approved', 'suggested', 'archived');

-- --- Equipe ------------------------------------------------------------------

create table public.comanda_staff (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  role        public.comanda_staff_role not null default 'garcom',
  -- Pendente (false) até um gerente ativar: quem não está ativo não vê nada.
  active      boolean not null default false,
  created_at  timestamptz not null default now(),
  approved_by uuid references public.comanda_staff (user_id),
  approved_at timestamptz
);

-- --- Catálogo ----------------------------------------------------------------

create table public.comanda_catalog (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  normalized   text not null,
  category     text not null default 'Outros' check (char_length(category) between 1 and 40),
  -- Centavos. NULL = ainda sem preço (alerta ao gerente). Teto: R$ 100.000,00.
  price_cents  integer check (price_cents is null or price_cents between 0 and 10000000),
  status       public.comanda_catalog_status not null default 'suggested',
  use_count    integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  -- Duplicata juntada a outro item; os totais usam o destino (sempre um item final).
  merged_into  uuid references public.comanda_catalog (id),
  created_at   timestamptz not null default now()
);

-- Um nome ativo por vez (acento e caixa não distinguem).
create unique index comanda_catalog_live_name
  on public.comanda_catalog (normalized)
  where status <> 'archived' and merged_into is null;

-- --- Comandas ----------------------------------------------------------------

create table public.comanda_tabs (
  id                    uuid primary key default gen_random_uuid(),
  -- Número curto do dia ("Comanda 27"), sequencial por dia de serviço.
  code                  integer not null check (code >= 1),
  -- Dia de serviço (corte às 6h, America/Sao_Paulo). A comanda só vale no dia.
  service_day           date not null,
  customer_name         text not null check (char_length(btrim(customer_name)) between 1 and 60),
  -- DDI + DDD + número, só dígitos. Ausente em `sem_celular`.
  phone                 text check (phone is null or phone ~ '^55[0-9]{10,11}$'),
  phone_last4           text check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$'),
  phone_status          public.comanda_phone_status not null,
  table_label           text check (table_label is null or char_length(table_label) <= 20),
  opened_by             text not null check (opened_by in ('cliente', 'garcom')),
  -- Só o hash do segredo fica aqui; o segredo em si é entregue uma vez ao aparelho.
  secret_hash           text,
  status                public.comanda_tab_status not null default 'aberta',
  opened_at             timestamptz not null default now(),
  bill_requested_at     timestamptz,
  closed_at             timestamptz,
  closed_by             uuid references public.comanda_staff (user_id),
  -- Total congelado no fechamento (conta final); só vale com status = 'fechada'.
  closed_total_cents    integer check (closed_total_cents is null or closed_total_cents >= 0),
  closed_unpriced_units integer check (closed_unpriced_units is null or closed_unpriced_units >= 0),
  payment_method        text check (payment_method is null or payment_method in ('dinheiro', 'cartao', 'pix', 'outro')),
  voided_at             timestamptz,
  constraint comanda_tabs_phone_consistency check (
    (phone is null and phone_last4 is null and phone_status = 'sem_celular')
    or (phone is not null and phone_last4 = right(phone, 4) and phone_status <> 'sem_celular')
  ),
  unique (service_day, code)
);

-- Um celular por dia: comanda anulada libera o número.
create unique index comanda_tabs_one_phone_per_day
  on public.comanda_tabs (service_day, phone)
  where phone is not null and status <> 'anulada';

create index comanda_tabs_by_day on public.comanda_tabs (service_day, code desc);

-- --- Itens (livro-razão: só de acréscimo) ------------------------------------

create table public.comanda_items (
  id               uuid primary key default gen_random_uuid(),
  tab_id           uuid not null references public.comanda_tabs (id) on delete restrict,
  catalog_item_id  uuid not null references public.comanda_catalog (id),
  -- Nome no momento do lançamento (renomear o catálogo não altera o passado).
  name_snapshot    text not null,
  qty              integer not null check (qty between -99 and 99 and qty <> 0),
  -- Preço unitário (centavos) da hora; NULL = lançado sem preço.
  unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0),
  -- Estorno é uma linha negativa apontando para a original (pode ser parcial).
  reverses_item_id uuid references public.comanda_items (id),
  added_by         uuid not null references public.comanda_staff (user_id),
  -- clock_timestamp (não now): linhas lançadas na mesma transação mantêm a ordem real.
  created_at       timestamptz not null default clock_timestamp(),
  constraint comanda_items_reversal_shape check (
    (qty > 0 and reverses_item_id is null) or (qty < 0 and reverses_item_id is not null)
  )
);

create index comanda_items_by_tab on public.comanda_items (tab_id, created_at);
create index comanda_items_by_reversed on public.comanda_items (reverses_item_id)
  where reverses_item_id is not null;

-- Auditoria de quem fez o quê (abertura, confirmação, conta, fechamento...).
create table public.comanda_tab_events (
  id        bigint generated always as identity primary key,
  tab_id    uuid not null references public.comanda_tabs (id) on delete restrict,
  kind      text not null,
  staff_id  uuid references public.comanda_staff (user_id),
  at        timestamptz not null default now(),
  detail    jsonb not null default '{}'::jsonb
);

create index comanda_tab_events_by_tab on public.comanda_tab_events (tab_id, at);

-- --- Trancas -----------------------------------------------------------------

alter table public.comanda_staff      enable row level security;
alter table public.comanda_catalog    enable row level security;
alter table public.comanda_tabs       enable row level security;
alter table public.comanda_items      enable row level security;
alter table public.comanda_tab_events enable row level security;

-- Sem política alguma + sem privilégio: só as funções SECURITY DEFINER chegam aqui.
revoke all on table
  public.comanda_staff,
  public.comanda_catalog,
  public.comanda_tabs,
  public.comanda_items,
  public.comanda_tab_events
from public, anon, authenticated;

-- Livro-razão e auditoria nunca são alterados nem apagados.
create function public.comanda_forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append-only' using errcode = 'P0001';
end;
$$;

create trigger comanda_items_append_only
  before update or delete on public.comanda_items
  for each row execute function public.comanda_forbid_change();

create trigger comanda_tab_events_append_only
  before update or delete on public.comanda_tab_events
  for each row execute function public.comanda_forbid_change();

-- Comanda anulada continua existindo (para auditoria): nunca é apagada.
create trigger comanda_tabs_no_delete
  before delete on public.comanda_tabs
  for each row execute function public.comanda_forbid_change();

-- --- Funções internas (não expostas na API) ----------------------------------

-- Dia de serviço: corte às 6h no horário de São Paulo ("a comanda só vale no dia").
create function public.comanda_service_day(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select ((p_at at time zone 'America/Sao_Paulo') - interval '6 hours')::date;
$$;

-- Minúsculas, sem acento, espaços normalizados: mesma regra do app (normalizeName).
create function public.comanda_normalize(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_text, '')),
      'áàâãäåéèêëíìîïóòôõöúùûüçñ',
      'aaaaaaeeeeiiiiooooouuuucn'),
    '\s+', ' ', 'g'));
$$;

-- Telefone brasileiro: DDI 55 + DDD + 8 ou 9 dígitos. NULL se não parecer um.
create function public.comanda_normalize_phone(p_raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
begin
  if length(v_digits) in (12, 13) then
    if left(v_digits, 2) = '55' then return v_digits; end if;
    return null;
  end if;
  if length(v_digits) in (10, 11) then
    return '55' || v_digits;
  end if;
  return null;
end;
$$;

-- Exige que quem chama seja da equipe, ativa, com um dos papéis. Devolve o id.
create function public.comanda_require_role(p_roles public.comanda_staff_role[])
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ok  boolean;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select true into v_ok
    from public.comanda_staff s
   where s.user_id = v_uid and s.active and s.role = any (p_roles);
  if v_ok is not true then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

-- Consumo da comanda, já descontados estornos e junções, com o total em centavos.
-- Venda feita SEM preço usa o preço atual do catálogo (precificar depois fecha a conta).
create function public.comanda_summary(p_tab_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with priced as (
    select coalesce(c.merged_into, c.id) as cid,
           i.qty,
           coalesce(i.unit_price_cents, t.price_cents) as unit
      from public.comanda_items i
      join public.comanda_catalog c on c.id = i.catalog_item_id
      join public.comanda_catalog t on t.id = coalesce(c.merged_into, c.id)
     where i.tab_id = p_tab_id
  ),
  lines as (
    select cid,
           sum(qty)::int as qty,
           sum(case when unit is null then 0 else qty * unit end)::int as total_cents,
           sum(case when unit is null then qty else 0 end)::int as unpriced_qty
      from priced
     group by cid
    having sum(qty) > 0
  )
  select jsonb_build_object(
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'catalog_item_id', l.cid,
               'name', t.name,
               'qty', l.qty,
               'total_cents', l.total_cents,
               'unpriced_qty', l.unpriced_qty) order by t.name)
        from lines l
        join public.comanda_catalog t on t.id = l.cid), '[]'::jsonb),
    'units', coalesce((select sum(qty) from lines), 0)::int,
    'total_cents', coalesce((select sum(total_cents) from lines), 0)::int,
    'unpriced_units', coalesce((select sum(unpriced_qty) from lines), 0)::int
  );
$$;

-- As funções internas não são chamáveis pela API. (Em Supabase, funções novas em
-- `public` nascem executáveis por anon/authenticated: revogamos explicitamente.)
revoke execute on function
  public.comanda_forbid_change(),
  public.comanda_service_day(timestamptz),
  public.comanda_normalize(text),
  public.comanda_normalize_phone(text),
  public.comanda_require_role(public.comanda_staff_role[]),
  public.comanda_summary(uuid)
from public, anon, authenticated;
