import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DAILY_KM_FLAG_THRESHOLD, POINTS, equivalentKm, type ActivityType } from '@/lib/constants';
import { isValidDateString } from '@/lib/dates';
import {
  addPoints,
  awardWeeklyTickets,
  checkFirstLogBadge,
  checkKmBadges,
  checkPerfectWeekBadge,
  loadSettings,
  multiplierFor,
  updateStreak,
  validateChallengeDate,
} from '@/lib/gamification';

const ACTIVITIES: ActivityType[] = ['run', 'walk', 'cycle', 'other'];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const activity = body.activity_type as ActivityType;
  const distanceKm = body.distance_km != null && body.distance_km !== '' ? Number(body.distance_km) : null;
  const durationMin = body.duration_min != null && body.duration_min !== '' ? Number(body.duration_min) : null;
  const localDate = body.local_date;

  if (!ACTIVITIES.includes(activity))
    return NextResponse.json({ error: 'Invalid activity type.' }, { status: 400 });
  if (!isValidDateString(localDate))
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
  if (activity === 'other') {
    if (!Number.isFinite(durationMin) || durationMin! < 1 || durationMin! > 1440)
      return NextResponse.json({ error: 'Duration must be 1–1440 minutes.' }, { status: 400 });
  } else {
    if (!Number.isFinite(distanceKm) || distanceKm! <= 0 || distanceKm! > 500)
      return NextResponse.json({ error: 'Distance must be 0–500 km.' }, { status: 400 });
    if (durationMin != null && (!Number.isFinite(durationMin) || durationMin < 1 || durationMin > 1440))
      return NextResponse.json({ error: 'Duration must be 1–1440 minutes.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const dateError = validateChallengeDate(localDate, settings);
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });

  const eqKm = equivalentKm(activity, distanceKm, durationMin);

  // Sanity flag: > 42 equivalent km on one day → keep, but flag for admin review
  const { data: dayLogs } = await admin
    .from('exercise_logs')
    .select('equivalent_km')
    .eq('user_id', user.id)
    .eq('local_date', localDate);
  const dayTotal = (dayLogs ?? []).reduce((s, r) => s + Number(r.equivalent_km), 0) + eqKm;
  const flagged = dayTotal > DAILY_KM_FLAG_THRESHOLD;

  const { data: log, error } = await admin
    .from('exercise_logs')
    .insert({
      user_id: user.id,
      activity_type: activity,
      distance_km: distanceKm,
      duration_min: durationMin,
      equivalent_km: eqKm,
      logged_at: new Date().toISOString(),
      local_date: localDate,
      flagged,
    })
    .select('id')
    .single();
  if (error || !log)
    return NextResponse.json({ error: 'Could not save the activity.' }, { status: 500 });

  const { factor } = await multiplierFor(admin, settings, localDate);
  const pointsEarned = Math.round(eqKm * POINTS.PER_EQUIVALENT_KM) * factor;
  await addPoints(admin, user.id, pointsEarned, 'exercise', 'exercise_logs', log.id, localDate);

  const newBadges: string[] = [];
  newBadges.push(...(await checkFirstLogBadge(admin, user.id)));
  newBadges.push(...(await updateStreak(admin, user.id, localDate)));
  newBadges.push(...(await checkKmBadges(admin, user.id)));
  newBadges.push(...(await checkPerfectWeekBadge(admin, user.id, localDate)));
  const newTickets = await awardWeeklyTickets(admin, user.id, localDate);

  return NextResponse.json({
    ok: true,
    points: pointsEarned,
    equivalent_km: eqKm,
    flagged,
    newBadges,
    newTickets,
  });
}
