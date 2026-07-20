import { redirect } from 'next/navigation';
import { getUserAndProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { profile } = await getUserAndProfile();
  if (!profile?.is_admin) redirect('/dashboard');
  const { q } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('profiles')
    .select('user_id, full_name, nickname, dob, sex, institution, contact, created_at, current_streak, logging_days')
    .order('created_at', { ascending: false });
  if (q) query = query.or(`full_name.ilike.%${q}%,nickname.ilike.%${q}%,institution.ilike.%${q}%`);
  const { data: rows } = await query;

  // Flagged exercise entries needing review
  const { data: flagged } = await admin
    .from('exercise_logs')
    .select('user_id, local_date, equivalent_km')
    .eq('flagged', true)
    .order('local_date', { ascending: false })
    .limit(20);
  const nickById = new Map((rows ?? []).map((r) => [r.user_id, r.nickname]));

  return (
    <div className="space-y-6">
      <form className="flex gap-2">
        <input name="q" defaultValue={q ?? ''} placeholder="Search name, nickname, institution…"
          className="w-full max-w-sm rounded-full border border-black/10 bg-white px-4 py-2 text-sm shadow-sm focus:border-brand focus:outline-none" />
        <button className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white">Search</button>
      </form>

      {!!flagged?.length && (
        <section className="rounded-2xl border border-gold bg-gold/10 p-4">
          <h2 className="text-sm font-bold">⚠️ Flagged for review (&gt;42 km/day)</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {flagged.map((f, i) => (
              <li key={i}>
                <strong>{nickById.get(f.user_id) ?? f.user_id.slice(0, 8)}</strong> — {f.equivalent_km} km on {f.local_date}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs text-foreground/50">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Nickname</th>
              <th className="px-4 py-3">DOB</th>
              <th className="px-4 py-3">Sex</th>
              <th className="px-4 py-3">Institution</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Streak</th>
              <th className="px-4 py-3">Days</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.user_id} className="border-b border-black/5">
                <td className="px-4 py-2.5 font-semibold">{r.full_name}</td>
                <td className="px-4 py-2.5">{r.nickname}</td>
                <td className="px-4 py-2.5">{r.dob}</td>
                <td className="px-4 py-2.5 capitalize">{r.sex}</td>
                <td className="px-4 py-2.5">{r.institution ?? '—'}</td>
                <td className="px-4 py-2.5">{r.contact ?? '—'}</td>
                <td className="px-4 py-2.5">🔥 {r.current_streak}</td>
                <td className="px-4 py-2.5">{r.logging_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(rows ?? []).length === 0 && (
          <p className="p-6 text-center text-sm text-foreground/50">No participants found.</p>
        )}
      </div>
    </div>
  );
}
