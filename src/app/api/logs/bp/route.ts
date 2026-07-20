import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BP_LIMITS, POINTS } from '@/lib/constants';
import { isValidDateString } from '@/lib/dates';
import {
  addPoints,
  addTicket,
  checkBpImproverBadge,
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

  const sbp = Number(body.sbp);
  const dbp = Number(body.dbp);
  const pulse = body.pulse != null && body.pulse !== '' ? Number(body.pulse) : null;
  const arm = body.arm === 'L' || body.arm === 'R' ? body.arm : null;
  const source = body.source === 'photo' ? 'photo' : 'manual';
  const photoPath = typeof body.photo_path === 'string' ? body.photo_path : null;
  const localDate = body.local_date;

  if (!Number.isInteger(sbp) || sbp < BP_LIMITS.sbp.min || sbp > BP_LIMITS.sbp.max)
    return NextResponse.json({ error: `Systolic must be ${BP_LIMITS.sbp.min}–${BP_LIMITS.sbp.max}.` }, { status: 400 });
  if (!Number.isInteger(dbp) || dbp < BP_LIMITS.dbp.min || dbp > BP_LIMITS.dbp.max)
    return NextResponse.json({ error: `Diastolic must be ${BP_LIMITS.dbp.min}–${BP_LIMITS.dbp.max}.` }, { status: 400 });
  if (dbp >= sbp)
    return NextResponse.json({ error: 'Diastolic must be lower than systolic.' }, { status: 400 });
  if (pulse !== null && (!Number.isInteger(pulse) || pulse < BP_LIMITS.pulse.min || pulse > BP_LIMITS.pulse.max))
    return NextResponse.json({ error: `Pulse must be ${BP_LIMITS.pulse.min}–${BP_LIMITS.pulse.max}.` }, { status: 400 });
  if (!isValidDateString(localDate))
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
  if (photoPath && !photoPath.startsWith(`${user.id}/`))
    return NextResponse.json({ error: 'Invalid photo path.' }, { status: 400 });

  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const dateError = validateChallengeDate(localDate, settings);
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });

  // One scoring BP log per local day
  const { data: existingScoring } = await admin
    .from('bp_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('local_date', localDate)
    .eq('is_scoring', true)
    .maybeSingle();
  const isScoring = !existingScoring;

  const { data: log, error } = await admin
    .from('bp_logs')
    .insert({
      user_id: user.id,
      sbp,
      dbp,
      pulse,
      arm,
      measured_at: new Date().toISOString(),
      local_date: localDate,
      source,
      photo_path: photoPath,
      is_scoring: isScoring,
    })
    .select('id')
    .single();
  if (error || !log)
    return NextResponse.json({ error: 'Could not save the reading.' }, { status: 500 });

  let pointsEarned = 0;
  const newBadges: string[] = [];
  if (isScoring) {
    pointsEarned = POINTS.PER_BP_LOG * multiplier(settings);
    await addPoints(admin, user.id, pointsEarned, 'bp_log', 'bp_logs', log.id, localDate);
    await addTicket(admin, user.id, 'bp_log', log.id);
    newBadges.push(...(await checkFirstLogBadge(admin, user.id)));
    newBadges.push(...(await updateStreak(admin, user.id, localDate)));
    newBadges.push(...(await checkPerfectWeekBadge(admin, user.id, localDate)));
  }
  newBadges.push(...(await checkBpImproverBadge(admin, user.id, localDate)));

  return NextResponse.json({ ok: true, points: pointsEarned, scoring: isScoring, newBadges });
}
