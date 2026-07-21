-- ============================================================
-- Migration v2 — demographics, weekly ticket goals, events,
-- landing-page settings. Safe to run repeatedly.
-- Run AFTER schema.sql in the Supabase SQL editor.
-- ============================================================

-- ---------- Profiles: expanded demographics ----------
alter table public.profiles add column if not exists race text;
alter table public.profiles add column if not exists ethnicity text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists education text;
alter table public.profiles add column if not exists position text;
alter table public.profiles add column if not exists research_consent boolean not null default false;
-- Streak rest-day shield: date of the last automatically-forgiven missed day
alter table public.profiles add column if not exists last_grace_date date;
-- Email reminders (opt-in) + throttle timestamp
alter table public.profiles add column if not exists email_reminders boolean not null default false;
alter table public.profiles add column if not exists last_reminder_at timestamptz;

-- ---------- App settings: landing page content ----------
alter table public.app_settings add column if not exists promo_video_url text;
alter table public.app_settings add column if not exists howto_video_url text;
alter table public.app_settings add column if not exists symposium_reg_url text;

-- ---------- Scheduled point events (e.g. double-point weekends) ----------
create table if not exists public.point_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  multiplier int not null default 2 check (multiplier between 1 and 5),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.point_events enable row level security;
drop policy if exists "events_select_all" on public.point_events;
create policy "events_select_all" on public.point_events
  for select using (auth.role() = 'authenticated');

-- ---------- Weekly-goal raffle tickets ----------
-- Tickets are now earned via weekly goals (not per log). goal_key is one of:
-- 'bp_week' | 'exercise_week' | 'weigh_week' | 'perfect_week'
alter table public.raffle_tickets add column if not exists iso_week text;
alter table public.raffle_tickets add column if not exists goal_key text;

-- One ticket per goal per week per user (nulls exempt legacy rows)
create unique index if not exists raffle_tickets_goal_unique
  on public.raffle_tickets (user_id, iso_week, goal_key)
  where iso_week is not null and goal_key is not null;

-- Remove legacy per-log tickets so everyone starts fair under the new rules
delete from public.raffle_tickets where goal_key is null;
