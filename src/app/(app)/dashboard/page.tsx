import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserAndProfile, getSettings } from '@/lib/auth';
import { BADGES, BP_TARGET, FINAL_SPRINT_DAYS, TICKET_GOALS } from '@/lib/constants';
import { addDays, daysBetween, isoWeekKey } from '@/lib/dates';
import { BPTrendChart, WeightTrendChart, type BpWeekPoint, type WeightPoint } from '@/components/Charts';
import { ReminderToggle } from '@/components/ReminderToggle';
import type { LeaderboardRow } from '@/lib/types';

export default async function DashboardPage() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !profile) redirect('/');
  const settings = await getSettings();
  const supabase = await createClient();

  const [bpRes, weightRes, exerciseRes, pointsRes, badgesRes, ticketsRes, lbRes] =
    await Promise.all([
      supabase.from('bp_logs').select('sbp, dbp, local_date').eq('user_id', user.id).order('local_date'),
      supabase.from('weight_logs').select('weight_kg, local_date').eq('user_id', user.id).eq('is_scoring', true).order('local_date'),
      supabase.from('exercise_logs').select('equivalent_km').eq('user_id', user.id),
      supabase.from('points_ledger').select('points').eq('user_id', user.id),
      supabase.from('badges').select('badge_key').eq('user_id', user.id),
      supabase.from('raffle_tickets').select('id').eq('user_id', user.id),
      supabase.rpc('get_leaderboard'),
    ]);

  const totalKm = Math.round(
    (exerciseRes.data ?? []).reduce((s, r) => s + Number(r.equivalent_km), 0) * 10
  ) / 10;
  const totalPoints = (pointsRes.data ?? []).reduce((s, r) => s + r.points, 0);
  const badges = (badgesRes.data ?? []).map((b) => b.badge_key);
  const tickets = ticketsRes.data?.length ?? 0;

  // Ranks
  const lb = (lbRes.data ?? []) as LeaderboardRow[];
  const byKm = [...lb].sort((a, b) => b.total_km - a.total_km);
  const byStreak = [...lb].sort(
    (a, b) => b.current_streak - a.current_streak || b.logging_days - a.logging_days
  );
  const kmRank = byKm.findIndex((r) => r.nickname === profile.nickname) + 1;
  const streakRank = byStreak.findIndex((r) => r.nickname === profile.nickname) + 1;

  // BP weekly averages
  const weekMap = new Map<string, { s: number[]; d: number[] }>();
  for (const r of bpRes.data ?? []) {
    const wk = isoWeekKey(r.local_date);
    const entry = weekMap.get(wk) ?? { s: [], d: [] };
    entry.s.push(r.sbp);
    entry.d.push(r.dbp);
    weekMap.set(wk, entry);
  }
  const bpWeekly: BpWeekPoint[] = [...weekMap.entries()].sort().map(([week, v]) => ({
    week: week.slice(5),
    sbp: Math.round(v.s.reduce((a, b) => a + b, 0) / v.s.length),
    dbp: Math.round(v.d.reduce((a, b) => a + b, 0) / v.d.length),
  }));
  const thisWeek = bpWeekly.at(-1);
  const onTarget = thisWeek && thisWeek.sbp! < BP_TARGET.sbp && thisWeek.dbp! < BP_TARGET.dbp;

  const weightData: WeightPoint[] = (weightRes.data ?? []).map((r) => ({
    date: r.local_date.slice(5),
    weight: Number(r.weight_kg),
  }));

  // Challenge arc
  const today = new Date().toISOString().slice(0, 10);

  // This week's ticket goals (Mon–Sun window containing today)
  const dow = new Date(today + 'T00:00:00Z').getUTCDay() || 7;
  const monday = addDays(today, 1 - dow);
  const sunday = addDays(monday, 6);
  const thisWeekKey = isoWeekKey(today);
  const bpDaysThisWeek = new Set(
    (bpRes.data ?? []).filter((r) => r.local_date >= monday && r.local_date <= sunday)
      .map((r) => r.local_date)
  ).size;
  const { data: exWeek } = await supabase
    .from('exercise_logs')
    .select('local_date, equivalent_km')
    .eq('user_id', user.id)
    .gte('local_date', monday)
    .lte('local_date', sunday);
  const exDaysThisWeek = new Set((exWeek ?? []).map((r) => r.local_date)).size;
  const exKmThisWeek = (exWeek ?? []).reduce((s, r) => s + Number(r.equivalent_km), 0);
  const { data: wtWeek } = await supabase
    .from('weight_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('iso_week', thisWeekKey)
    .limit(1);
  const goalStatus = [
    {
      key: 'bp_week',
      met: bpDaysThisWeek >= 4,
      progress: `${Math.min(bpDaysThisWeek, 4)}/4 days`,
    },
    {
      key: 'exercise_week',
      met: exDaysThisWeek >= 3 || exKmThisWeek >= 10,
      progress:
        exDaysThisWeek >= 3 || exKmThisWeek >= 10
          ? 'done'
          : `${exDaysThisWeek}/3 days · ${Math.round(exKmThisWeek * 10) / 10}/10 km`,
    },
    { key: 'weigh_week', met: (wtWeek?.length ?? 0) > 0, progress: (wtWeek?.length ?? 0) > 0 ? 'done' : '0/1' },
  ] as const;
  const perfectMet = goalStatus.every((g) => g.met);

  // Active point event banner
  const { data: activeEvents } = await supabase
    .from('point_events')
    .select('name, multiplier')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('multiplier', { ascending: false })
    .limit(1);
  const activeEvent = activeEvents?.[0] ?? null;
  const daysLeft = settings ? Math.max(0, daysBetween(today, settings.challenge_end_date)) : null;
  const totalDays = settings
    ? daysBetween(settings.challenge_start_date, settings.challenge_end_date)
    : null;
  const elapsed = settings ? daysBetween(settings.challenge_start_date, today) : null;
  const midpoint =
    settings && totalDays && elapsed !== null && Math.abs(elapsed - totalDays / 2) <= 3;
  const finalSprint = daysLeft !== null && daysLeft <= FINAL_SPRINT_DAYS && daysLeft > 0;

  const stat = 'rounded-2xl bg-white p-4 text-center shadow-sm';

  return (
    <main className="space-y-5 px-5 py-5">
      {/* Challenge arc banners */}
      {activeEvent && (
        <div className="animate-pop-in rounded-2xl bg-gradient-to-r from-brand to-gold px-4 py-3 text-center text-sm font-extrabold text-white shadow">
          ⚡ {activeEvent.name} — ×{activeEvent.multiplier} points right now!
        </div>
      )}
      {settings?.double_points && !activeEvent && (
        <div className="animate-pop-in rounded-2xl bg-gold px-4 py-3 text-center text-sm font-extrabold text-white shadow">
          ⚡ DOUBLE POINTS are ON — everything counts twice right now!
        </div>
      )}
      {midpoint && !settings?.double_points && (
        <div className="rounded-2xl bg-accent px-4 py-3 text-center text-sm font-bold text-white shadow">
          🏁 Halfway there! Keep the momentum going.
        </div>
      )}
      {finalSprint && (
        <div className="rounded-2xl bg-brand px-4 py-3 text-center text-sm font-bold text-white shadow">
          🔥 Final sprint — only {daysLeft} day{daysLeft === 1 ? '' : 's'} left!
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Hi, {profile.nickname}!</h1>
          {daysLeft !== null && (
            <p className="text-sm text-foreground/60">
              {daysLeft > 0 ? `${daysLeft} days remaining` : 'The challenge has ended — see you at the symposium!'}
            </p>
          )}
        </div>
        <Link href="/log"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-lg">
          + Log
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className={stat}>
          <p className="text-2xl font-extrabold text-brand">{totalPoints}</p>
          <p className="text-xs font-semibold text-foreground/60">points</p>
        </div>
        <div className={stat}>
          <p className="text-2xl font-extrabold text-accent">{totalKm}</p>
          <p className="text-xs font-semibold text-foreground/60">km total</p>
        </div>
        <div className={stat} title="One missed day per week is automatically forgiven">
          <p className="text-2xl font-extrabold text-gold">🔥 {profile.current_streak}</p>
          <p className="text-xs font-semibold text-foreground/60">day streak 🛡️</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className={stat}>
          <p className="text-xl font-extrabold">#{kmRank || '–'}</p>
          <p className="text-xs font-semibold text-foreground/60">distance rank</p>
        </div>
        <div className={stat}>
          <p className="text-xl font-extrabold">#{streakRank || '–'}</p>
          <p className="text-xs font-semibold text-foreground/60">consistency</p>
        </div>
        <div className={stat}>
          <p className="text-xl font-extrabold">🎟️ {tickets}</p>
          <p className="text-xs font-semibold text-foreground/60">raffle tickets</p>
        </div>
      </div>

      {/* Weekly ticket goals */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">🎟️ This week&apos;s ticket goals</h2>
          <span className="text-xs text-foreground/50">1 raffle ticket each</span>
        </div>
        <ul className="mt-3 space-y-2">
          {goalStatus.map((g) => (
            <li key={g.key} className="flex items-center justify-between text-sm">
              <span className={g.met ? 'text-foreground' : 'text-foreground/60'}>
                {g.met ? '✅' : '⬜'} {TICKET_GOALS[g.key].description}
              </span>
              <span className={`text-xs font-bold ${g.met ? 'text-accent' : 'text-foreground/40'}`}>
                {g.met ? '+1 🎟️' : g.progress}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between border-t border-black/5 pt-2 text-sm">
            <span className={perfectMet ? 'font-bold' : 'text-foreground/60'}>
              {perfectMet ? '⭐' : '⬜'} {TICKET_GOALS.perfect_week.description}
            </span>
            {perfectMet && <span className="text-xs font-bold text-gold">+1 🎟️</span>}
          </li>
        </ul>
      </section>

      {/* BP trend */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">🩺 Blood pressure trend</h2>
          {thisWeek && (
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                onTarget ? 'bg-accent/15 text-accent' : 'bg-gold/20 text-yellow-700'
              }`}>
              {thisWeek.sbp}/{thisWeek.dbp} {onTarget ? '· on target 🎯' : '· keep going 💪'}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-foreground/50">
          Weekly averages · home target &lt; {BP_TARGET.sbp}/{BP_TARGET.dbp} mmHg
        </p>
        <div className="mt-3">
          <BPTrendChart data={bpWeekly} />
        </div>
      </section>

      {/* Weight trend */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">⚖️ Weight vs baseline ({profile.weight_kg_baseline} kg)</h2>
        <div className="mt-3">
          <WeightTrendChart data={weightData} baseline={Number(profile.weight_kg_baseline)} />
        </div>
      </section>

      {/* Badges strip */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">🏅 Badges</h2>
          <Link href="/awards" className="text-xs font-semibold text-accent underline">
            See all
          </Link>
        </div>
        {badges.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/50">
            No badges yet — your first log earns one instantly! 🎉
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {badges.map((key) => (
              <span key={key} title={BADGES[key]?.label}
                className="rounded-full bg-gold/15 px-3 py-1.5 text-sm font-bold">
                {BADGES[key]?.emoji} {BADGES[key]?.label ?? key}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Preferences + my data */}
      <ReminderToggle initial={profile.email_reminders ?? false} />
      <section className="pb-2 text-center">
        <a href="/api/me/export"
          className="inline-block rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-black/10">
          ⬇️ Download all my data (CSV)
        </a>
      </section>
    </main>
  );
}
