-- =============================================================================
-- Karaokê Just Go — modelo da sala de karaokê
--
-- Substitui o domínio anterior (sessões/apresentações/votação/gamificação) pelo
-- modelo do app atual: uma SALA de karaokê com fila, telão e publicidade.
--
-- As tabelas legadas NÃO são removidas por esta migration: elas guardam dados
-- reais das noites já realizadas. A remoção é uma decisão de negócio e está
-- isolada em supabase/scripts/drop-legacy-schema.sql, para ser executada
-- manualmente depois que os dados forem arquivados.
--
-- ATENÇÃO — postura de segurança do MVP:
-- o Host entra sem senha (decisão de produto, ver docs/SECURITY.md), então as
-- políticas abaixo liberam leitura e escrita para a role anon. Isso é aceitável
-- enquanto a operação é de um bar só, com link não divulgado. Ao abrir para
-- múltiplos estabelecimentos, migrar para Supabase Auth e restringir a escrita
-- da fila/telão ao Host autenticado.
-- =============================================================================

-- --- Tipos -------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'karaoke_entry_status') then
    create type public.karaoke_entry_status as enum (
      'pending',    -- proposta pelo participante, aguardando o Host
      'waiting',    -- aprovada e na fila
      'playing',    -- em execução (no máximo uma por sala)
      'completed',  -- apresentada
      'cancelled'   -- pulada ou cancelada
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'karaoke_screen_content_type') then
    create type public.karaoke_screen_content_type as enum (
      'karaoke', 'cta', 'notice', 'ad', 'qrcode'
    );
  end if;
end $$;

-- --- Salas -------------------------------------------------------------------

create table if not exists public.karaoke_rooms (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  host_name         text,
  screen_online     boolean not null default true,
  -- Conteúdo temporário no telão. NULL = telão exibindo o karaokê.
  screen_content_id uuid,
  -- Quando o conteúdo temporário expira. NULL = até o Host remover.
  screen_expires_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.karaoke_rooms is
  'Uma sala/noite de karaokê. O estado do telão vive aqui para que todos os dispositivos convirjam.';

-- --- Fila --------------------------------------------------------------------

create table if not exists public.karaoke_queue_entries (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.karaoke_rooms(id) on delete cascade,
  participant    text not null check (length(btrim(participant)) between 1 and 60),
  phone          text,
  song_title     text not null,
  song_artist    text not null default '',
  song_duration  text not null default '—',
  song_thumbnail text,
  youtube_id     text not null,
  status         public.karaoke_entry_status not null default 'pending',
  -- Ordem na fila. O status 'next' NÃO é persistido: é derivado da posição.
  position       integer not null default 0,
  requested_at   timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);

comment on column public.karaoke_queue_entries.position is
  'Ordem na fila. Quem tem a menor posição entre os waiting é o proximo a cantar.';

create index if not exists karaoke_queue_entries_room_status_idx
  on public.karaoke_queue_entries (room_id, status, position);

-- Regra de negócio 3: apenas uma apresentação em execução por sala.
create unique index if not exists karaoke_queue_entries_one_playing_idx
  on public.karaoke_queue_entries (room_id)
  where status = 'playing';

-- --- Conteúdos do telão ------------------------------------------------------

create table if not exists public.karaoke_screen_contents (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.karaoke_rooms(id) on delete cascade,
  type             public.karaoke_screen_content_type not null,
  title            text not null,
  body             text,
  image_url        text,
  -- Segundos. NULL = exibe até o Host encerrar manualmente.
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 3600),
  -- 1 karaokê · 2 aviso urgente · 3 CTA · 4 publicidade
  priority         smallint not null default 3 check (priority between 1 and 4),
  created_at       timestamptz not null default now()
);

create index if not exists karaoke_screen_contents_room_idx
  on public.karaoke_screen_contents (room_id, created_at desc);

alter table public.karaoke_rooms
  drop constraint if exists karaoke_rooms_screen_content_id_fkey;

alter table public.karaoke_rooms
  add constraint karaoke_rooms_screen_content_id_fkey
  foreign key (screen_content_id)
  references public.karaoke_screen_contents(id)
  on delete set null;

-- --- Publicidade -------------------------------------------------------------

create table if not exists public.karaoke_advertisements (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.karaoke_rooms(id) on delete cascade,
  title            text not null,
  image_url        text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 3600),
  created_at       timestamptz not null default now()
);

create index if not exists karaoke_advertisements_room_idx
  on public.karaoke_advertisements (room_id, created_at desc);

-- --- RLS ---------------------------------------------------------------------

alter table public.karaoke_rooms            enable row level security;
alter table public.karaoke_queue_entries    enable row level security;
alter table public.karaoke_screen_contents  enable row level security;
alter table public.karaoke_advertisements   enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'karaoke_rooms',
    'karaoke_queue_entries',
    'karaoke_screen_contents',
    'karaoke_advertisements'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_all', t);
    -- MVP sem autenticação: participante e Host usam a mesma role anon.
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      t || '_anon_all', t
    );
  end loop;
end $$;

-- --- Realtime ----------------------------------------------------------------
-- O telão, o celular e o painel do Host acompanham a mesma sala em tempo real.

do $$
declare
  t text;
begin
  foreach t in array array[
    'karaoke_rooms',
    'karaoke_queue_entries',
    'karaoke_advertisements'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- --- Sala padrão desta implantação ------------------------------------------

insert into public.karaoke_rooms (slug, name)
values ('just-go', 'Karaokê Just Go')
on conflict (slug) do nothing;
