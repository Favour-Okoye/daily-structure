-- Daily Structure migration 0001 — all core tables (Phases 1-8).
-- ADDITIVE ONLY: creates ds_* objects and touches NOTHING else.
-- This runs in the SAME Supabase project as MoneyTree; never ALTER/DROP
-- anything without the ds_ prefix from here.
-- Paste into Supabase Studio -> SQL Editor -> Run. Safe to run once.

create table public.ds_profiles (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name   text not null default 'Favour',
  timezone       text not null default 'Europe/Brussels',
  season         text not null default 'gap' check (season in ('gap','work')),
  xp_total       int  not null default 0,      -- cache; ds_xp_events is the truth
  current_streak int  not null default 0,
  longest_streak int  not null default 0,
  last_activity_on date,
  created_at     timestamptz not null default now()
);

create table public.ds_xp_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action      text not null,
  points      int  not null,
  ref_type    text,
  ref_id      text,
  happened_on date not null,   -- APP-day (flips at 04:00 Brussels), computed client-side
  created_at  timestamptz not null default now()
);
-- Can't double-earn XP for the same thing; conflicts mean "already earned".
create unique index ds_xp_dedupe on public.ds_xp_events (user_id, action, ref_type, ref_id)
  where ref_id is not null;
create index ds_xp_day_idx on public.ds_xp_events (user_id, happened_on);

create view public.ds_v_xp_by_day with (security_invoker = true) as
  select user_id, happened_on, sum(points)::int as points
  from public.ds_xp_events
  group by user_id, happened_on;

-- One row per completed (or grace-excused) anchor per app-day.
create table public.ds_anchor_log (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day         date not null,
  anchor_slug text not null,
  status      text not null default 'done' check (status in ('done','grace')),
  done_at     timestamptz not null default now(),
  meta        jsonb not null default '{}'::jsonb,  -- quietSeconds, withSister, graceReason...
  primary key (user_id, day, anchor_slug)
);

create table public.ds_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null,
  notes        text,
  kind         text not null default 'general'
               check (kind in ('general','job_application','job_followup','bi_practice','church','errand')),
  due_on       date,
  est_minutes  int  not null default 30,
  status       text not null default 'open' check (status in ('open','done','dropped')),
  completed_on date,
  created_at   timestamptz not null default now()
);
create index ds_tasks_open_idx on public.ds_tasks (user_id, status, due_on);

-- One-off calendar events (e.g. "sanctuary cleaning, Sat 09:00-11:00").
create table public.ds_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null,
  day        date not null,
  start_min  smallint not null,   -- wall-clock minutes from midnight
  end_min    smallint not null,
  kind       text not null default 'church',
  created_at timestamptz not null default now()
);
create index ds_events_day_idx on public.ds_events (user_id, day);

create table public.ds_day_plans (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day         date not null,
  plan        jsonb not null,          -- versioned DayPlan blob
  built_at    timestamptz not null default now(),
  approved_at timestamptz,             -- stamped by the nightly ceremony
  primary key (user_id, day)
);

-- The crew: the entire game state as ONE versioned JSONB blob (MoneyTree farm pattern).
create table public.ds_game_state (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.ds_settings (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  confession_lines text[] not null default array[
    'Open More -> Confession to paste your confession, one line at a time.'],
  data             jsonb not null default '{}'::jsonb,  -- anchorOverrides, fridayOnline, etc.
  updated_at       timestamptz not null default now()
);

-- Row-level security: own rows only, on every ds_ table.
alter table public.ds_profiles   enable row level security;
alter table public.ds_xp_events  enable row level security;
alter table public.ds_anchor_log enable row level security;
alter table public.ds_tasks      enable row level security;
alter table public.ds_events     enable row level security;
alter table public.ds_day_plans  enable row level security;
alter table public.ds_game_state enable row level security;
alter table public.ds_settings   enable row level security;

create policy "own rows" on public.ds_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.ds_xp_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.ds_anchor_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.ds_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.ds_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.ds_day_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.ds_game_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.ds_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
