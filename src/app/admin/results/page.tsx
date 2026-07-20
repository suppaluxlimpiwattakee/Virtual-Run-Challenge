import { redirect } from 'next/navigation';
import { getUserAndProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { LeaderboardRow } from '@/lib/types';

const TOP_N = 10;

export default async function ResultsPage() {
  const { profile } = await getUserAndProfile();
  if (!profile?.is_admin) redirect('/dashboard');
  const admin = createAdminClient();

  const [lbRes, improverRes, drawsRes, profilesRes] = await Promise.all([
    admin.rpc('get_leaderboard'),
    admin.from('badges').select('user_id, earned_at').eq('badge_key', 'bp_improver'),
    admin.from('raffle_draws').select('winner_user_id, prize, drawn_at').order('drawn_at'),
    admin.from('profiles').select('user_id, nickname, full_name'),
  ]);

  const lb = (lbRes.data ?? []) as LeaderboardRow[];
  const byKm = [...lb].sort((a, b) => b.total_km - a.total_km).slice(0, TOP_N);
  const byStreak = [...lb]
    .sort((a, b) => b.current_streak - a.current_streak || b.logging_days - a.logging_days)
    .slice(0, TOP_N);
  const people = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));

  const card = 'rounded-2xl bg-white p-5 shadow-sm';

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className={card}>
        <h2 className="font-bold">🏃 Top {TOP_N} — Distance</h2>
        <ol className="mt-3 space-y-1 text-sm">
          {byKm.map((r, i) => (
            <li key={r.nickname} className="flex justify-between">
              <span>{i + 1}. {r.nickname}</span>
              <strong>{r.total_km} km</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className={card}>
        <h2 className="font-bold">🔥 Top {TOP_N} — Consistency</h2>
        <ol className="mt-3 space-y-1 text-sm">
          {byStreak.map((r, i) => (
            <li key={r.nickname} className="flex justify-between">
              <span>{i + 1}. {r.nickname}</span>
              <strong>{r.current_streak} days ({r.logging_days} total)</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className={card}>
        <h2 className="font-bold">❤️ BP Improvers (SBP ↓ ≥ 5 mmHg)</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {(improverRes.data ?? []).map((b) => (
            <li key={b.user_id}>
              {people.get(b.user_id)?.nickname ?? '—'}{' '}
              <span className="text-foreground/50">
                ({people.get(b.user_id)?.full_name}) · {new Date(b.earned_at).toLocaleDateString()}
              </span>
            </li>
          ))}
          {!improverRes.data?.length && (
            <p className="text-foreground/50">None yet.</p>
          )}
        </ul>
      </section>

      <section className={card}>
        <h2 className="font-bold">🎟️ Raffle winners</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {(drawsRes.data ?? []).map((d, i) => (
            <li key={i}>
              🏆 {people.get(d.winner_user_id)?.nickname ?? '—'}{' '}
              <span className="text-foreground/50">
                ({people.get(d.winner_user_id)?.full_name})
                {d.prize ? ` · ${d.prize}` : ''} · {new Date(d.drawn_at).toLocaleDateString()}
              </span>
            </li>
          ))}
          {!drawsRes.data?.length && <p className="text-foreground/50">No draws yet.</p>}
        </ul>
      </section>

      <div className="md:col-span-2">
        <a href="/api/admin/export?table=points_ledger"
          className="inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white">
          ⬇ Export full points ledger
        </a>
      </div>
    </div>
  );
}
