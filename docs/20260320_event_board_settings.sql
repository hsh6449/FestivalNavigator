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

create index if not exists event_board_settings_event_day_idx
  on public.event_board_settings (event_id, day_key);
