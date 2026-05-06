-- Support tables for review and notification features.
-- Prerequisite: public.events already exists.
-- These tables assume Supabase Auth is enabled and auth.users is available.

create extension if not exists "pgcrypto";

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  type text not null check (type in ('ticketing', 'start')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, event_id, type)
);

create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null,
  status text not null check (status in ('sent', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists reviews_event_created_idx
  on public.reviews (event_id, created_at desc);

create index if not exists reviews_user_idx
  on public.reviews (user_id);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notification_history_user_sent_idx
  on public.notification_history (user_id, sent_at desc);

alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_history enable row level security;

drop policy if exists "reviews are publicly readable" on public.reviews;
create policy "reviews are publicly readable"
  on public.reviews
  for select
  using (true);

drop policy if exists "authenticated users can insert own reviews" on public.reviews;
create policy "authenticated users can insert own reviews"
  on public.reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own reviews" on public.reviews;
create policy "users can delete own reviews"
  on public.reviews
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can view own notifications" on public.notifications;
create policy "users can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own notifications" on public.notifications;
create policy "users can insert own notifications"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own notifications" on public.notifications;
create policy "users can delete own notifications"
  on public.notifications
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can view own notification history" on public.notification_history;
create policy "users can view own notification history"
  on public.notification_history
  for select
  to authenticated
  using (auth.uid() = user_id);
