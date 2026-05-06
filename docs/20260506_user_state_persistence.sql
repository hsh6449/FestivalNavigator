-- Draft migration for future user-state persistence.
-- Purpose:
-- 1. Keep current local-first UX unchanged today.
-- 2. Reserve Supabase tables for followed artists and personal planner items.
-- 3. Make localStorage -> server migration predictable later.
--
-- Prerequisites:
-- - public.events already exists
-- - auth.users is available (Supabase Auth)
-- - pgcrypto extension is available for gen_random_uuid()

create extension if not exists "pgcrypto";

create table if not exists public.followed_artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete set null,
  artist_slug text not null,
  artist_name text not null,
  last_event_id uuid references public.events(id) on delete set null,
  last_event_title text,
  last_seen_date date,
  last_seen_stage text,
  followed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, artist_slug)
);

create table if not exists public.planner_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_item_id text not null,
  event_id uuid not null references public.events(id) on delete cascade,
  event_title text not null,
  event_venue text not null,
  event_image_url text,
  planner_date date not null,
  day_label text not null,
  item_type text not null check (item_type in ('performance', 'meal', 'rest', 'move', 'custom')),
  title text not null,
  stage text,
  artist text,
  default_start timestamptz,
  default_end timestamptz,
  planned_start timestamptz not null,
  planned_end timestamptz not null,
  order_index integer,
  note text,
  source text not null check (source in ('festival-slot', 'manual')),
  linked_slot_id text,
  is_active boolean not null default true,
  migrated_from_local boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, client_item_id),
  unique nulls not distinct (user_id, linked_slot_id),
  check (planned_end > planned_start)
);

create index if not exists followed_artists_user_followed_idx
  on public.followed_artists (user_id, followed_at desc);

create index if not exists followed_artists_slug_idx
  on public.followed_artists (artist_slug);

create index if not exists planner_items_user_date_idx
  on public.planner_items (user_id, planner_date, planned_start asc);

create index if not exists planner_items_event_idx
  on public.planner_items (event_id, planner_date);

create index if not exists planner_items_linked_slot_idx
  on public.planner_items (linked_slot_id);

alter table public.followed_artists enable row level security;
alter table public.planner_items enable row level security;

drop policy if exists "users can view own followed artists" on public.followed_artists;
create policy "users can view own followed artists"
  on public.followed_artists
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own followed artists" on public.followed_artists;
create policy "users can insert own followed artists"
  on public.followed_artists
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own followed artists" on public.followed_artists;
create policy "users can update own followed artists"
  on public.followed_artists
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own followed artists" on public.followed_artists;
create policy "users can delete own followed artists"
  on public.followed_artists
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can view own planner items" on public.planner_items;
create policy "users can view own planner items"
  on public.planner_items
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own planner items" on public.planner_items;
create policy "users can insert own planner items"
  on public.planner_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own planner items" on public.planner_items;
create policy "users can update own planner items"
  on public.planner_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own planner items" on public.planner_items;
create policy "users can delete own planner items"
  on public.planner_items
  for delete
  to authenticated
  using (auth.uid() = user_id);
