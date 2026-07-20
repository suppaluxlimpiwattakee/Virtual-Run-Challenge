import { createAdminClient } from '@/lib/supabase/admin';
import { isoWeekKey } from '@/lib/dates';
import {
  BreakdownBars,
  BreakdownPie,
  CohortBpChart,
  WeeklyBarChart,
} from '@/components/CohortCharts';

// Cohort-level analytics for the symposium presentation. All aggregates are
// anonymous — no individual is identifiable. (Admin layout gates access.)
export default async function AdminChartsPage() {
  const admin = createAdminClient();

  const [profilesRes, bpRes, exRes] = await Promise.all([
    admin.from('profiles').select('dob, sex, position, race, ethnicity, education, research_consent'),
    admin.from('bp_logs').select('sbp, dbp, local_date, user_id'),
    admin.from('exercise_logs').select('equivalent_km, local_date, user_id'),
  ]);
  const profiles = profilesRes.data ?? [];
  const bpLogs = bpRes.data ?? [];
  const exLogs = exRes.data ?? [];

  // ---- Cohort weekly average BP ----
  const bpByWeek = new Map<string, { sbp: number[]; dbp: number[] }>();
  for (const r of bpLogs) {
    const week = isoWeekKey(r.local_date);
    if (!bpByWeek.has(week)) bpByWeek.set(week, { sbp: [], dbp: [] });
    bpByWeek.get(week)!.sbp.push(r.sbp);
    bpByWeek.get(week)!.dbp.push(r.dbp);
  }
  const bpWeekly = [...bpByWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({
      week: week.slice(5), // 'W29'
      sbp: Math.round(v.sbp.reduce((s, x) => s + x, 0) / v.sbp.length),
      dbp: Math.round(v.dbp.reduce((s, x) => s + x, 0) / v.dbp.length),
      readings: v.sbp.length,
    }));

  // ---- Weekly activity ----
  const kmByWeek = new Map<string, number>();
  const activeByWeek = new Map<string, Set<string>>();
  for (const r of exLogs) {
    const week = isoWeekKey(r.local_date);
    kmByWeek.set(week, (kmByWeek.get(week) ?? 0) + Number(r.equivalent_km));
    if (!activeByWeek.has(week)) activeByWeek.set(week, new Set());
    activeByWeek.get(week)!.add(r.user_id);
  }
  for (const r of bpLogs) {
    const week = isoWeekKey(r.local_date);
    if (!activeByWeek.has(week)) activeByWeek.set(week, new Set());
    activeByWeek.get(week)!.add(r.user_id);
  }
  const weeks = [...new Set([...kmByWeek.keys(), ...activeByWeek.keys()])].sort();
  const kmWeekly = weeks.map((w) => ({ week: w.slice(5), km: Math.round(kmByWeek.get(w) ?? 0) }));
  const activeWeekly = weeks.map((w) => ({
    week: w.slice(5),
    participants: activeByWeek.get(w)?.size ?? 0,
  }));

  // ---- Demographics ----
  const count = (fn: (p: (typeof profiles)[number]) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const p of profiles) {
      const k = fn(p) || 'Not specified';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const ageBand = (dob: string) => {
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
    if (age < 25) return '18–24';
    if (age < 35) return '25–34';
    if (age < 45) return '35–44';
    if (age < 55) return '45–54';
    if (age < 65) return '55–64';
    return '65+';
  };

  const researchYes = profiles.filter((p) => p.research_consent).length;

  const card = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className={card + ' flex-1 text-center'}>
          <p className="text-3xl font-extrabold text-brand">{profiles.length}</p>
          <p className="text-xs text-foreground/60">participants</p>
        </div>
        <div className={card + ' flex-1 text-center'}>
          <p className="text-3xl font-extrabold text-accent">{bpLogs.length}</p>
          <p className="text-xs text-foreground/60">BP readings</p>
        </div>
        <div className={card + ' flex-1 text-center'}>
          <p className="text-3xl font-extrabold text-gold">
            {Math.round(exLogs.reduce((s, r) => s + Number(r.equivalent_km), 0))}
          </p>
          <p className="text-xs text-foreground/60">total km</p>
        </div>
        <div className={card + ' flex-1 text-center'}>
          <p className="text-3xl font-extrabold">{researchYes}</p>
          <p className="text-xs text-foreground/60">research consents</p>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-bold">🩺 Cohort blood pressure — weekly average</h2>
        <p className="mb-3 text-xs text-foreground/60">
          Average of all home readings across the cohort. A downward drift over the challenge is
          the headline chart for the symposium.
        </p>
        <CohortBpChart data={bpWeekly} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className={card}>
          <h2 className="mb-3 font-bold">👟 Weekly distance (km)</h2>
          <WeeklyBarChart data={kmWeekly} dataKey="km" name="Equivalent km" color="#2a9d8f" />
        </div>
        <div className={card}>
          <h2 className="mb-3 font-bold">🧑‍🤝‍🧑 Weekly active participants</h2>
          <WeeklyBarChart data={activeWeekly} dataKey="participants" name="Active" color="#f4a825" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className={card}>
          <h2 className="mb-3 font-bold">Position</h2>
          <BreakdownBars data={count((p) => p.position)} />
        </div>
        <div className={card}>
          <h2 className="mb-3 font-bold">Gender</h2>
          <BreakdownPie data={count((p) => p.sex)} />
        </div>
        <div className={card}>
          <h2 className="mb-3 font-bold">Age</h2>
          <BreakdownBars data={count((p) => (p.dob ? ageBand(p.dob) : null))} color="#d53f8c" />
        </div>
        <div className={card}>
          <h2 className="mb-3 font-bold">Race</h2>
          <BreakdownBars data={count((p) => p.race)} color="#38a169" />
        </div>
        <div className={card}>
          <h2 className="mb-3 font-bold">Ethnicity</h2>
          <BreakdownPie data={count((p) => p.ethnicity)} />
        </div>
        <div className={card}>
          <h2 className="mb-3 font-bold">Education</h2>
          <BreakdownBars data={count((p) => p.education)} color="#5a67d8" />
        </div>
      </div>
    </div>
  );
}
