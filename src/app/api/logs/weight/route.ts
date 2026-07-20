import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { POINTS, WEIGHT_LIMITS } from '@/lib/constants';
import { isValidDateString, isoWeekKey } from '@/lib/dates';
import {
  addPoints,
  addTicket,
  checkFirstLogBadge,
  checkPerfectWeekBadge,
  loadSettings,
  multiplier,
  updateStreak,
  validateChallengeDate,
} from '@/lib/gamification';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const weight = Number(body.weight_kg);
  const localDate = body.local_date;

  if (!Number.isFinite(weight) || weight < WEIGHT_LIMITS.min || weight > WEIGHT_LIMITS.max)
    return NextResponse.json({ error: 'Weight must be 25–300 kg.' }, { status: 400 });
  if (!isValidDateString(localDate))
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });

  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const dateError = validateChallengeDate(localDate, settings);
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });

  const week = isoWeekKey(localDate);
  const { data: existingScoring } = await admin
    .from('weight_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('iso_week', week)
    .eq('is_scoring', true)
    .maybeSingle();
  const isScoring = !existingScoring;

  const { data: log, error } = await admin
    .from('weight_logs')
    .insert({
      user_id: user.id,
      weight_kg: Math.round(weight * 10) / 10,
      logged_at: new Date().toISOString(),
      local_date: localDate,
      iso_week: week,
      is_scoring: isScoring,
    })
    .select('id')
    .single();
  if (error || !log)
    return NextResponse.json({ error: 'Could not save the weigh-in.' }, { status: 500 });

  let pointsEarned = 0;
  const newBadges: string[] = [];
  if (isScoring) {
    pointsEarned = POINTS.PER_WEIGH_IN * multiplier(settings);
    await addPoints(admin, user.id, pointsEarned, 'weigh_in', 'weight_logs', log.id, localDate);
    await addTicket(admin, user.id, 'weigh_in', log.id);
    newBadges.push(...(await checkFirstLogBadge(admin, user.id)));
    newBadges.push(...(await updateStreak(admin, user.id, localDate)));
    newBadges.push(...(await checkPerfectWeekBadge(admin, user.id, localDate)));
  }

  return NextResponse.json({ ok: true, points: pointsEarned, scoring: isScoring, newBadges });
}
