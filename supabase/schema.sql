-- ============================================================
-- Virtual Run Challenge — Supabase schema, RLS, and functions
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  nickname text not null unique check (char_length(nickname) between 2 and 24),
  dob date not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  height_cm numeric(5,1) not null check (height_cm between 90 and 250),
  weight_kg_baseline numeric(5,1) not null check (weight_kg_baseline between 25 and 300),
  occupation text,
  institution text,
  contact text, -- phone or LINE ID
  consent_at timestamptz not null,
  is_admin boolean not null default false,
  -- streak bookkeeping (maintained server-side by API routes)
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_log_date date,
  logging_days int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  sbp int not null check (sbp between 60 and 260),
  dbp int not null check (dbp between 30 and 160),
  pulse int check (pulse between 25 and 220),
  arm text check (arm in ('L', 'R')),
  measured_at timestamptz not null,
  local_date date not null,
  source text not null default 'manual' check (source in ('manual', 'photo')),
  photo_path text, -- path inside private 'bp-photos' bucket
  is_scoring boolean not null default false, -- first BP log of the local day
  created_at timestamptz not null default now()
);
create index if not exists bp_logs_user_date on public.bp_logs (user_id, local_date);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  activity_type text not null check (activity_type in ('run', 'walk', 'cycle', 'other')),
  distance_km numeric(6,2) check (distance_km >= 0 and distance_km <= 500),
  duration_min int check (duration_min between 1 and 1440),
  equivalent_km numeric(6,2) not null check (equivalent_km >= 0),
  logged_at timestamptz not null,
  local_date date not null,
  flagged boolean not null default false, -- > 42 km/day sanity flag for admin review
  created_at timestamptz not null default now()
);
create index if not exists exercise_logs_user_date on public.exercise_logs (user_id, local_date);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  weight_kg numeric(5,1) not null check (weight_kg between 25 and 300),
  logged_at timestamptz not null,
  local_date date not null,
  iso_week text not null, -- e.g. '2026-W29' — one scoring weigh-in per week
  is_scoring boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weight_logs_user_week on public.weight_logs (user_id, iso_week);

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  points int not null,
  reason text not null, -- 'exercise' | 'bp_log' | 'weigh_in' | 'streak_bonus'
  ref_table text,
  ref_id uuid,
  ref_date date, -- used to make streak bonuses idempotent per day
  created_at timestamptz not null default now()
);
create index if not exists points_ledger_user on public.points_ledger (user_id);

create table if not exists public.raffle_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  source text not null, -- 'bp_log' | 'exercise' | 'weigh_in'
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists raffle_tickets_user on public.raffle_tickets (user_id);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1), -- singleton row
  challenge_start_date date not null,
  challenge_end_date date not null,
  route_name text not null default 'Run to the Symposium',
  route_total_km numeric(8,1) not null default 1000,
  double_points boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, challenge_start_date, challenge_end_date)
values (1, current_date, current_date + interval '60 days')
on conflict (id) do nothing;

create table if not exists public.raffle_draws (
  id uuid primary key default gen_random_uuid(),
  winner_user_id uuid not null references public.profiles(user_id),
  prize text,
  drawn_at timestamptz not null default now()
);

-- ---------- Helper: admin check (bypasses RLS via security definer) ----------

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

-- ---------- Row-Level Security ----------

alter table public.profiles enable row level security;
alter table public.bp_logs enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.points_ledger enable row level security;
alter table public.raffle_tickets enable row level security;
alter table public.badges enable row level security;
alter table public.app_settings enable row level security;
alter table public.raffle_draws enable row level security;

-- profiles: read/update own row; admins read all. Inserts happen via the
-- service role during registration (so is_admin can never be self-set).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and is_admin = false);

-- logs: participants read their own rows; admins read all.
-- All INSERTs go through server API routes using the service role
-- (points/tickets/streaks must be awarded server-side), so no insert
-- policies are granted to authenticated users.
drop policy if exists "bp_select_own" on public.bp_logs;
create policy "bp_select_own" on public.bp_logs
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "exercise_select_own" on public.exercise_logs;
create policy "exercise_select_own" on public.exercise_logs
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "weight_select_own" on public.weight_logs;
create policy "weight_select_own" on public.weight_logs
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "ledger_select_own" on public.points_ledger;
create policy "ledger_select_own" on public.points_ledger
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "tickets_select_own" on public.raffle_tickets;
create policy "tickets_select_own" on public.raffle_tickets
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "badges_select_own" on public.badges;
create policy "badges_select_own" on public.badges
  for select using (auth.uid() = user_id or public.is_admin());

-- settings: everyone signed-in can read; only service role writes.
drop policy if exists "settings_select_all" on public.app_settings;
create policy "settings_select_all" on public.app_settings
  for select using (auth.role() = 'authenticated');

-- raffle draws: admins only.
drop policy if exists "draws_admin_select" on public.raffle_draws;
create policy "draws_admin_select" on public.raffle_draws
  for select using (public.is_admin());

-- ---------- Leaderboard (privacy-safe, SECURITY DEFINER) ----------
-- Exposes ONLY nickname + activity aggregates. Never BP, weight, or demographics.

create or replace function public.get_leaderboard()
returns table (
  nickname text,
  total_points bigint,
  total_km numeric,
  current_streak int,
  logging_days int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.nickname,
    coalesce((select sum(points) from public.points_ledger l where l.user_id = p.user_id), 0)::bigint as total_points,
    coalesce((select round(sum(equivalent_km), 1) from public.exercise_logs e where e.user_id = p.user_id), 0) as total_km,
    p.current_streak,
    p.logging_days
  from public.profiles p
  order by total_km desc;
$$;

grant execute on function public.get_leaderboard() to authenticated;

create or replace function public.get_collective_progress()
returns table (total_km numeric, participants bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(round(sum(equivalent_km), 1), 0) as total_km,
    (select count(*) from public.profiles) as participants
  from public.exercise_logs;
$$;

grant execute on function public.get_collective_progress() to authenticated;

-- ---------- Storage (run after creating the PRIVATE 'bp-photos' bucket) ----------
-- Bucket: bp-photos  (public = OFF). Files are stored at <user_id>/<filename>.

drop policy if exists "bp_photos_insert_own" on storage.objects;
create policy "bp_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'bp-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "bp_photos_select_own" on storage.objects;
create policy "bp_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'bp-photos'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );
