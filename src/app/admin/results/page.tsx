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
    admin.from('profiles').select('user_id, nickname, full_name, sex'),
  ]);

  const lb = (lbRes.data ?? []) as LeaderboardRow[];
  const byKmAll = [...lb].sort((a, b) => b.total_km - a.total_km);
  const byKm = byKmAll.slice(0, TOP_N);
  const byStreak = [...lb]
    .sort((a, b) => b.current_streak - a.current_streak || b.logging_days - a.logging_days)
    .slice(0, TOP_N);
  const people = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
  const sexByNickname = new Map((profilesRes.data ?? []).map((p) => [p.nickname, p.sex]));
  const nameByNickname = new Map((profilesRes.data ?? []).map((p) => [p.nickname, p.full_name]));

  const champion = (sex: string) =>
    byKmAll.find((r) => sexByNickname.get(r.nickname) === sex && r.total_km > 0) ?? null;
  const maleChamp = champion('male');
  const femaleChamp = champion('female');

  const card = 'rounded-2xl bg-white p-5 shadow-sm';

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Champions podium */}
      <section className={`${card} md:col-span-2 bg-gradient-to-r from-brand/5 to-gold/10`}>
        <h2 className="text-center text-lg font-extrabold">🏆 Challenge champions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: '1st place — Male', champ: maleChamp },
            { label: '1st place — Female', champ: femaleChamp },
          ].map(({ label, champ }) => (
            <div key={label} className="rounded-2xl bg-white p-5 text-center shadow ring-1 ring-gold/40">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground/50">{label}</p>
              {champ ? (
                <>
                  <p className="mt-1 text-3xl font-extrabold text-brand">🥇 {champ.nickname}</p>
                  <p className="text-sm text-foreground/60">
                    {nameByNickname.get(champ.nickname)} · {champ.total_km} km ·{' '}
                    {champ.total_points} pts
                  </p>
                </>
              ) : (
                <p className="mt-2 text-foreground/50">No qualifying distance yet</p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-foreground/50">
          Every participant receives the souvenir + CME credit for taking part 🎁
        </p>
      </section>
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
