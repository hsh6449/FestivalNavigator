-- Draft migration for festival-first core tables.
-- If your existing public.events.id column is text/slug-based instead of uuid,
-- change the event_id column types below to match before executing.

create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  description text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  venue text not null,
  venue_address text,
  venue_lat double precision,
  venue_lng double precision,
  genre text not null,
  event_type text default 'festival',
  image_url text,
  price_range text,
  ticket_url text,
  ticket_open_time timestamptz,
  age_limit text,
  artist_profile text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_en text,
  artist_type text not null default 'other',
  genres text[],
  bio text,
  image_url text,
  country_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_artists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  role text not null default 'lineup',
  display_order integer,
  is_headliner boolean not null default false,
  announcement_status text not null default 'confirmed',
  performance_date date,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, artist_id, performance_date)
);

create table if not exists public.event_stages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  performance_date date,
  stage_name text not null,
  display_order integer,
  is_hidden boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, performance_date, stage_name)
);

create table if not exists public.event_board_settings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  day_key text not null,
  visible_start_time text not null,
  visible_end_time text not null,
  interval_minutes integer not null default 5,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, day_key)
);

create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete set null,
  event_artist_id uuid references public.event_artists(id) on delete set null,
  stage_name text not null,
  slot_type text not null default 'performance',
  title text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_cancelled boolean not null default false,
  source text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint schedule_slots_time_check check (end_at > start_at)
);

create table if not exists public.ticket_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  provider_name text not null,
  provider_code text,
  url text not null,
  link_type text not null default 'general',
  sales_status text not null default 'upcoming',
  opens_at timestamptz,
  ends_at timestamptz,
  price_note text,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists artists_name_idx
  on public.artists (name);

create index if not exists events_type_start_idx
  on public.events (event_type, start_date);

create index if not exists events_genre_start_idx
  on public.events (genre, start_date);

create index if not exists event_artists_event_order_idx
  on public.event_artists (event_id, display_order);

create index if not exists event_artists_artist_idx
  on public.event_artists (artist_id);

create index if not exists event_artists_headliner_idx
  on public.event_artists (event_id, is_headliner);

create index if not exists event_stages_event_order_idx
  on public.event_stages (event_id, performance_date, display_order);

create index if not exists event_board_settings_event_day_idx
  on public.event_board_settings (event_id, day_key);

create index if not exists schedule_slots_event_start_idx
  on public.schedule_slots (event_id, start_at);

create index if not exists schedule_slots_event_stage_start_idx
  on public.schedule_slots (event_id, stage_name, start_at);

create index if not exists schedule_slots_artist_idx
  on public.schedule_slots (artist_id);

create index if not exists ticket_links_event_primary_open_idx
  on public.ticket_links (event_id, is_primary desc, opens_at);

create index if not exists ticket_links_event_status_idx
  on public.ticket_links (event_id, sales_status);
