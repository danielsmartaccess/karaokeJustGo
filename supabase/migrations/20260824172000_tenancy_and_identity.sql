-- FASE 2: fundação multi-tenant + identidade
-- Tabelas: tenants, venues, profiles, venue_staff
-- Convenções: docs/DATABASE.md (uuid pk, created_at/updated_at, RLS habilitado em tudo)

-- ---------------------------------------------------------------------------
-- Função utilitária: mantém updated_at em dia via trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tenants — a empresa/operação dona de um ou mais venues (ex.: Just Go)
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

alter table public.tenants enable row level security;

create policy "tenants are publicly readable"
  on public.tenants for select
  using (true);

-- ---------------------------------------------------------------------------
-- venues — um estabelecimento físico onde ocorrem sessões de karaokê
-- ---------------------------------------------------------------------------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  city text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index venues_tenant_id_idx on public.venues (tenant_id);

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

alter table public.venues enable row level security;

create policy "venues are publicly readable"
  on public.venues for select
  using (true);

-- ---------------------------------------------------------------------------
-- profiles — identidade de app de cada usuário autenticado (1:1 com auth.users)
-- Cadastro mínimo: nome + WhatsApp (docs/PRODUCT.md, docs/SECURITY.md)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  whatsapp text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Cria profile automaticamente quando um novo usuário se autentica.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Participante'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- venue_staff — quem é HOST/ADMIN em qual venue (papéis são por venue, não globais)
-- Todo mundo é implicitamente PARTICIPANT; HOST/ADMIN exige uma linha aqui.
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('HOST', 'ADMIN');

create table public.venue_staff (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.staff_role not null default 'HOST',
  created_at timestamptz not null default now(),
  unique (venue_id, profile_id)
);

create index venue_staff_venue_id_idx on public.venue_staff (venue_id);
create index venue_staff_profile_id_idx on public.venue_staff (profile_id);

alter table public.venue_staff enable row level security;

create policy "staff can view own staff rows"
  on public.venue_staff for select
  using (auth.uid() = profile_id);
