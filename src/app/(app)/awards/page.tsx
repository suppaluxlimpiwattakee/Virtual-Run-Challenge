import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserAndProfile } from '@/lib/auth';
import { BADGES } from '@/lib/constants';

export default async function AwardsPage() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !profile) redirect('/');
  const supabase = await createClient();

  const [badgesRes, ticketsRes] = await Promise.all([
    supabase.from('badges').select('badge_key, earned_at').eq('user_id', user.id),
    supabase.from('raffle_tickets').select('id').eq('user_id', user.id),
  ]);

  const earned = new Map((badgesRes.data ?? []).map((b) => [b.badge_key, b.earned_at]));
  const tickets = ticketsRes.data?.length ?? 0;

  return (
    <main className="space-y-5 px-5 py-5">
      <h1 className="text-2xl font-extrabold">Awards</h1>

      <section className="rounded-2xl bg-gradient-to-br from-brand to-gold p-5 text-center text-white shadow-lg">
        <p className="text-5xl">🎟️</p>
        <p className="mt-1 text-3xl font-extrabold">{tickets}</p>
        <p className="text-sm font-semibold opacity-90">raffle tickets</p>
        <p className="mt-2 text-xs opacity-80">
          Every scoring log earns a ticket. Winners are drawn live at the symposium — anyone can
          win!
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Badges ({earned.size}/{Object.keys(BADGES).length})</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(BADGES).map(([key, b]) => {
            const has = earned.has(key);
            return (
              <div key={key}
                className={`rounded-2xl p-4 text-center shadow-sm ${
                  has ? 'bg-white' : 'bg-white/40 opacity-50 grayscale'
                }`}>
                <p className="text-3xl">{b.emoji}</p>
                <p className="mt-1 text-sm font-extrabold">{b.label}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-foreground/60">{b.description}</p>
                {has && (
                  <p className="mt-1 text-[10px] font-semibold text-accent">
                    ✓ {new Date(earned.get(key)!).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
