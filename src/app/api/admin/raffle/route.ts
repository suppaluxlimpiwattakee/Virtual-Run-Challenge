import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

/**
 * Draws winner(s) weighted by ticket count. Body: { count?: number, prize?: string,
 * excludePrevious?: boolean }. Returns nicknames + ticket counts for the reveal.
 */
export async function POST(req: NextRequest) {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body.count) || 1, 1), 20);
  const prize = typeof body.prize === 'string' ? body.prize.trim() || null : null;
  const excludePrevious = body.excludePrevious !== false; // default: no repeat winners

  const { data: tickets } = await admin.from('raffle_tickets').select('user_id');
  if (!tickets?.length)
    return NextResponse.json({ error: 'No raffle tickets yet.' }, { status: 400 });

  const { data: previous } = excludePrevious
    ? await admin.from('raffle_draws').select('winner_user_id')
    : { data: [] as { winner_user_id: string }[] };
  const excluded = new Set((previous ?? []).map((p) => p.winner_user_id));

  // ticket counts per user
  const counts = new Map<string, number>();
  for (const t of tickets) {
    if (excluded.has(t.user_id)) continue;
    counts.set(t.user_id, (counts.get(t.user_id) ?? 0) + 1);
  }
  if (!counts.size)
    return NextResponse.json({ error: 'Everyone with tickets has already won.' }, { status: 400 });

  const winners: { user_id: string; ticket_count: number }[] = [];
  for (let i = 0; i < count && counts.size > 0; i++) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [userId, c] of counts) {
      roll -= c;
      if (roll <= 0) {
        winners.push({ user_id: userId, ticket_count: c });
        counts.delete(userId); // each participant can win once per draw batch
        break;
      }
    }
  }

  const { data: profiles } = await admin
    .from('profiles')
    .select('user_id, nickname, full_name')
    .in('user_id', winners.map((w) => w.user_id));
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  for (const w of winners) {
    await admin.from('raffle_draws').insert({ winner_user_id: w.user_id, prize });
  }

  return NextResponse.json({
    winners: winners.map((w) => ({
      nickname: byId.get(w.user_id)?.nickname ?? '???',
      full_name: byId.get(w.user_id)?.full_name ?? '',
      tickets: w.ticket_count,
    })),
  });
}
