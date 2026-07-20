import { redirect } from 'next/navigation';
import { getUserAndProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { LogsPerDayChart } from '@/components/AdminCharts';
import { addDays } from '@/lib/dates';

export default async function AdminOverview() {
  const { profile } = await getUserAndProfile();
  if (!profile?.is_admin) redirect('/dashboard');
  const admin = createAdminClient();

  const since = addDays(new Date().toISOString().slice(0, 10), -13);

  const [profilesRes, bpRes, exRes, wtRes, settingsRes, kmRes] = await Promise.all([
    admin.from('profiles').select('user_id, created_at'),
    admin.from('bp_logs').select('user_id, local_date').gte('local_date', since),
    admin.from('exercise_logs').select('user_id, local_date, equivalent_km').gte('local_date', since),
    admin.from('weight_logs').select('user_id, local_date').gte('local_date', since),
    admin.from('app_settings').select('*').eq('id', 1).single(),
    admin.from('exercise_logs').select('equivalent_km'),
  ]);

  const totalParticipants = profilesRes.data?.length ?? 0;
  const weekAgo = addDays(new Date().toISOString().slice(0, 10), -6);
  const activeUsers = new Set(
    [...(bpRes.data ?? []), ...(exRes.data ?? []), ...(wtRes.data ?? [])]
      .filter((r) => r.local_date >= weekAgo)
      .map((r) => r.user_id)
  ).size;

  const perDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    perDay.set(addDays(new Date().toISOString().slice(0, 10), -i), 0);
  }
  for (const r of [...(bpRes.data ?? []), ...(exRes.data ?? []), ...(wtRes.data ?? [])]) {
    if (perDay.has(r.local_date)) perDay.set(r.local_date, perDay.get(r.local_date)! + 1);
  }
  const chartData = [...perDay.entries()].map(([date, logs]) => ({ date: date.slice(5), logs }));

  const totalKm =
    Math.round(((kmRes.data ?? []).reduce((s, r) => s + Number(r.equivalent_km), 0)) * 10) / 10;
  const settings = settingsRes.data;

  const stat = 'rounded-2xl bg-white p-5 text-center shadow-sm';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className={stat}>
          <p className="text-3xl font-extrabold text-brand">{totalParticipants}</p>
          <p className="text-xs font-semibold text-foreground/60">participants</p>
        </div>
        <div className={stat}>
          <p className="text-3xl font-extrabold text-accent">{activeUsers}</p>
          <p className="text-xs font-semibold text-foreground/60">active last 7 days</p>
        </div>
        <div className={stat}>
          <p className="text-3xl font-extrabold text-gold">{totalKm}</p>
          <p className="text-xs font-semibold text-foreground/60">
            collective km / {settings?.route_total_km ?? '—'}
          </p>
        </div>
        <div className={stat}>
          <p className="text-3xl font-extrabold">{settings?.double_points ? '⚡ ON' : 'off'}</p>
          <p className="text-xs font-semibold text-foreground/60">double points</p>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-bold">Logs per day (last 14 days)</h2>
        <div className="mt-3">
          <LogsPerDayChart data={chartData} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-bold">CSV exports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {['profiles', 'bp_logs', 'exercise_logs', 'weight_logs', 'points_ledger', 'raffle_tickets'].map(
            (t) => (
              <a key={t} href={`/api/admin/export?table=${t}`}
                className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-white">
                ⬇ {t}.csv
              </a>
            )
          )}
        </div>
      </section>
    </div>
  );
}
