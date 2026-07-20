import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserAndProfile, getSettings } from '@/lib/auth';
import { RouteProgress } from '@/components/RouteProgress';
import type { LeaderboardRow } from '@/lib/types';

function Board({
  title,
  subtitle,
  rows,
  me,
  value,
  unit,
}: {
  title: string;
  subtitle: string;
  rows: LeaderboardRow[];
  me: string;
  value: (r: LeaderboardRow) => number | string;
  unit: string;
}) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <p className="text-xs text-foreground/50">{subtitle}</p>
      <ol className="mt-3 space-y-1">
        {rows.slice(0, 20).map((r, i) => (
          <li key={r.nickname}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
              r.nickname === me ? 'bg-brand/10 font-extrabold' : i % 2 ? 'bg-black/[0.02]' : ''
            }`}>
            <span className="flex items-center gap-2">
              <span className="w-7 text-center">{medals[i] ?? `${i + 1}.`}</span>
              {r.nickname}
              {r.nickname === me && <span className="text-[10px] text-brand">you</span>}
            </span>
            <span className="font-bold">
              {value(r)} <span className="text-xs font-normal text-foreground/50">{unit}</span>
            </span>
          </li>
        ))}
        {rows.length === 0 && (
          <p className="py-4 text-center text-sm text-foreground/50">No entries yet — be the first!</p>
        )}
      </ol>
    </section>
  );
}

export default async function LeaderboardPage() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !profile) redirect('/');
  const settings = await getSettings();
  const supabase = await createClient();

  const [lbRes, progressRes] = await Promise.all([
    supabase.rpc('get_leaderboard'),
    supabase.rpc('get_collective_progress'),
  ]);

  const lb = (lbRes.data ?? []) as LeaderboardRow[];
  const progress = progressRes.data?.[0] as { total_km: number; participants: number } | undefined;

  const byKm = [...lb].sort((a, b) => b.total_km - a.total_km);
  const byConsistency = [...lb].sort(
    (a, b) => b.current_streak - a.current_streak || b.logging_days - a.logging_days
  );

  return (
    <main className="space-y-5 px-5 py-5">
      <h1 className="text-2xl font-extrabold">Leaderboards</h1>

      {settings && progress && (
        <RouteProgress
          totalKm={Number(progress.total_km)}
          routeTotalKm={Number(settings.route_total_km)}
          routeName={settings.route_name}
          participants={Number(progress.participants)}
        />
      )}

      <Board
        title="🏃 Distance"
        subtitle="Total equivalent kilometers"
        rows={byKm}
        me={profile.nickname}
        value={(r) => r.total_km}
        unit="km"
      />
      <Board
        title="🔥 Consistency"
        subtitle="Current streak — slow and steady wins too!"
        rows={byConsistency}
        me={profile.nickname}
        value={(r) => r.current_streak}
        unit="days"
      />

      <p className="pb-4 text-center text-xs text-foreground/40">
        Leaderboards show nicknames only. Health data is never shared.
      </p>
    </main>
  );
}
