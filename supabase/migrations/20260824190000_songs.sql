-- FASE 4: catálogo de músicas
-- Catálogo curado (sem upload de usuário — docs/PRODUCT.md, seção 60), compartilhado entre
-- venues do mesmo tenant/rede (sem venue_id: um catálogo de karaokê é essencialmente
-- universal; escopo por venue pode ser adicionado depois se algum dia for necessário).

create extension if not exists pg_trgm;

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  genre text,
  language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, artist)
);

create index songs_title_trgm_idx on public.songs using gin (title gin_trgm_ops);
create index songs_artist_trgm_idx on public.songs using gin (artist gin_trgm_ops);

create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

alter table public.songs enable row level security;

create policy "songs are publicly readable"
  on public.songs for select
  using (true);

create policy "venue staff can manage the song catalog"
  on public.songs for all
  using (exists (select 1 from public.venue_staff where venue_staff.profile_id = auth.uid()))
  with check (exists (select 1 from public.venue_staff where venue_staff.profile_id = auth.uid()));

create table public.user_favorite_songs (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, song_id)
);

create index user_favorite_songs_song_id_idx on public.user_favorite_songs (song_id);

alter table public.user_favorite_songs enable row level security;

create policy "users manage their own favorites"
  on public.user_favorite_songs for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
