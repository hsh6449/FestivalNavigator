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

create index if not exists event_stages_event_order_idx
  on public.event_stages (event_id, performance_date, display_order);
