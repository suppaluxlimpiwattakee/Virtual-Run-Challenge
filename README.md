# 🏃‍♀️ Virtual Run Challenge

A mobile-first 2-month pre-symposium health engagement platform. Participants log **blood
pressure, exercise, and weight**, earn points/badges/raffle tickets, climb two leaderboards
(distance + consistency), and collectively "run" a themed route to the symposium. Winners are
announced live at the event with an animated raffle draw.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth +
Storage) · Anthropic API (`claude-sonnet-4-6`) for BP-monitor photo reading · Recharts ·
deployable on Vercel free tier.

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **Schema + RLS:** open *SQL Editor* → paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql) → Run. This creates all tables, row-level
   security policies, the privacy-safe leaderboard functions, and storage policies.
3. **Storage bucket:** *Storage → New bucket* → name `bp-photos` → **Public bucket: OFF**
   (must be private). The SQL you already ran contains the per-user access policies.
   > If you created the bucket *after* running the SQL and the storage policies errored,
   > re-run just the two `create policy "bp_photos_…"` statements at the bottom of the file.
4. **Google OAuth:**
   - In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an
     *OAuth client ID* (type: Web application).
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - In Supabase: *Authentication → Providers → Google* → enable, paste Client ID + Secret.
   - In Supabase: *Authentication → URL Configuration* → set **Site URL** to your app URL
     (e.g. `http://localhost:3000` for dev, your Vercel URL in prod) and add
     `http://localhost:3000/auth/callback` + `https://<your-app>.vercel.app/auth/callback`
     to **Redirect URLs**.

## 2. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**server-only — never commit**) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) (**server-only**) |
| `NEXT_PUBLIC_SITE_URL` | Your app URL |

## 3. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

### Seed demo data (optional, recommended for development)

```bash
npx tsx scripts/seed.ts
```

Creates 5 fake participants with a month of BP/exercise/weight logs, points, tickets, and
badges so the leaderboards, charts, and admin panel have data.

### Make yourself an admin

The `is_admin` flag can **only** be set directly in the database (never via the app):

```sql
update public.profiles set is_admin = true where nickname = 'YourNickname';
```

An **Admin** link then appears in the app header → overview dashboard, participant table,
CSV exports, challenge settings (dates, route, double-points toggle), the live raffle draw
tool, and final results.

## 4. Deploy (Vercel)

1. Push to GitHub → import in Vercel.
2. Add the same environment variables (set `NEXT_PUBLIC_SITE_URL` to the production URL).
3. Add the production callback URL to Supabase *Redirect URLs* (step 1.4).

---

## How scoring works

| Action | Points | Raffle ticket |
|---|---|---|
| Exercise | 1 pt / equivalent km (cycle ×0.4, walk 1:1, other: 10 min ≈ 1 km) | ✅ every log |
| Blood pressure | 2 pts (first reading each day) | ✅ scoring log |
| Weekly weigh-in | 5 pts (one per calendar week) | ✅ scoring log |
| 7-day streak | +20 pts at every 7 consecutive days | — |
| Double points | Admin toggle multiplies all points ×2 | — |

Extra readings/weigh-ins are always saved for trends — they just don't double-score.
Exercise entries over 42 km/day are kept but flagged for admin review.

**Badges:** first log · 7/30-day streak · 50/100/200 km · BP Improver (weekly avg SBP down
≥5 mmHg vs 4 weeks ago) · Perfect Week (all three modules in one week).

## Privacy model

- RLS on every table: participants only ever read their own rows.
- Leaderboards go through a `security definer` function that returns **nickname, points, km,
  streak** — nothing else.
- BP photos live in a **private** bucket under `user_id/…` with per-user access policies.
- All writes (logs, points, tickets) go through server API routes with server-side validation
  (BP ranges, dates inside the challenge window, no future dates) — the browser can never
  award itself points.
- `ANTHROPIC_API_KEY` and the service-role key are server-only env vars.

## Safety

Readings ≥180/120 mmHg trigger a prominent, non-gamified warning (rest 5 min, re-measure,
seek urgent care if still elevated or symptomatic). No confetti or points fanfare is shown
for those readings.

## Project layout

```
supabase/schema.sql        # tables, RLS, leaderboard RPCs, storage policies
scripts/seed.ts            # demo data
src/lib/                   # constants (scoring rules), gamification engine, supabase clients
src/app/api/               # register, logs/{bp,exercise,weight}, extract-bp, admin/*
src/app/(app)/             # participant: dashboard, log, leaderboard, awards
src/app/admin/             # admin panel (server-side is_admin gate)
```
