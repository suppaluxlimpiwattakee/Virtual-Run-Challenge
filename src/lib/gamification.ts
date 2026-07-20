// Server-side scoring engine. All functions take the service-role client and
// run ONLY inside API routes after the caller's session has been verified.
import type { SupabaseClient } from '@supabase/supabase-js';
import { POINTS } from '@/lib/constants';
import { addDays, isoWeekKey } from '@/lib/dates';
import type { AppSettings } from '@/lib/types';

type Admin = SupabaseClient;

export async function loadSettings(admin: Admin): Promise<AppSettings> {
  const { data, error } = await admin.from('app_settings').select('*').eq('id', 1).single();
  if (error || !data) throw new Error('App settings missing — run supabase/schema.sql');
  return data as AppSettings;
}

/** Reject logs outside the challenge window or in the future. */
export function validateChallengeDate(localDate: string, settings: AppSettings): string | null {
  if (localDate < settings.challenge_start_date)
    return `The challenge starts on ${settings.challenge_start_date}.`;
  if (localDate > settings.challenge_end_date)
    return `The challenge ended on ${settings.challenge_end_date}.`;
  // Allow up to one day ahead of server UTC to cover all timezones, no more.
  const maxAllowed = addDays(new Date().toISOString().slice(0, 10), 1);
  if (localDate > maxAllowed) return 'You cannot log for a future date.';
  return null;
}

export function multiplier(settings: AppSettings): number {
  return settings.double_points ? 2 : 1;
}

export async function addPoints(
  admin: Admin,
  userId: string,
  points: number,
  reason: string,
  refTable: string | null,
  refId: string | null,
  refDate: string | null
) {
  if (points <= 0) return;
  await admin.from('points_ledger').insert({
    user_id: userId,
    points,
    reason,
    ref_table: refTable,
    ref_id: refId,
    ref_date: refDate,
  });
}

export async function addTicket(admin: Admin, userId: string, source: string, refId: string) {
  await admin.from('raffle_tickets').insert({ user_id: userId, source, ref_id: refId });
}

export async function awardBadge(admin: Admin, userId: string, badgeKey: string): Promise<boolean> {
  const { error } = await admin.from('badges').insert({ user_id: userId, badge_key: badgeKey });
  return !error; // unique constraint → error when already earned
}

/**
 * Update the user's streak for a newly logged local date and award the +20
 * bonus each time the streak reaches a multiple of 7 (idempotent per date).
 * Returns badge keys newly earned.
 */
export async function updateStreak(
  admin: Admin,
  userId: string,
  localDate: string
): Promise<string[]> {
  const newBadges: string[] = [];
  const { data: profile } = await admin
    .from('profiles')
    .select('current_streak, longest_streak, last_log_date, logging_days')
    .eq('user_id', userId)
    .single();
  if (!profile) return newBadges;

  const last: string | null = profile.last_log_date;
  if (last === localDate) return newBadges; // already counted today

  let streak: number;
  if (last && addDays(last, 1) === localDate) {
    streak = profile.current_streak + 1;
  } else if (last && localDate < last) {
    return newBadges; // backdated log — don't disturb the streak
  } else {
    streak = 1;
  }

  await admin
    .from('profiles')
    .update({
      current_streak: streak,
      longest_streak: Math.max(streak, profile.longest_streak),
      last_log_date: localDate,
      logging_days: profile.logging_days + 1,
    })
    .eq('user_id', userId);

  if (streak > 0 && streak % 7 === 0) {
    // Idempotent: only one streak bonus per date
    const { data: existing } = await admin
      .from('points_ledger')
      .select('id')
      .eq('user_id', userId)
      .eq('reason', 'streak_bonus')
      .eq('ref_date', localDate)
      .maybeSingle();
    if (!existing) {
      await addPoints(admin, userId, POINTS.STREAK_BONUS, 'streak_bonus', null, null, localDate);
    }
  }

  if (streak >= 7 && (await awardBadge(admin, userId, 'streak_7'))) newBadges.push('streak_7');
  if (streak >= 30 && (await awardBadge(admin, userId, 'streak_30'))) newBadges.push('streak_30');
  return newBadges;
}

export async function checkFirstLogBadge(admin: Admin, userId: string): Promise<string[]> {
  return (await awardBadge(admin, userId, 'first_log')) ? ['first_log'] : [];
}

export async function checkKmBadges(admin: Admin, userId: string): Promise<string[]> {
  const { data } = await admin
    .from('exercise_logs')
    .select('equivalent_km')
    .eq('user_id', userId);
  const total = (data ?? []).reduce((s, r) => s + Number(r.equivalent_km), 0);
  const earned: string[] = [];
  for (const [km, key] of [
    [50, 'km_50'],
    [100, 'km_100'],
    [200, 'km_200'],
  ] as const) {
    if (total >= km && (await awardBadge(admin, userId, key))) earned.push(key);
  }
  return earned;
}

/** BP Improver: mean SBP of the last 7 days is ≥5 mmHg below the mean of days 22–28 ago. */
export async function checkBpImproverBadge(
  admin: Admin,
  userId: string,
  localDate: string
): Promise<string[]> {
  const recentStart = addDays(localDate, -6);
  const baseStart = addDays(localDate, -27);
  const baseEnd = addDays(localDate, -21);

  const { data } = await admin
    .from('bp_logs')
    .select('sbp, local_date')
    .eq('user_id', userId)
    .gte('local_date', baseStart)
    .lte('local_date', localDate);
  if (!data) return [];

  const recent = data.filter((r) => r.local_date >= recentStart);
  const baseline = data.filter((r) => r.local_date >= baseStart && r.local_date <= baseEnd);
  if (recent.length < 3 || baseline.length < 3) return [];

  const mean = (rows: { sbp: number }[]) => rows.reduce((s, r) => s + r.sbp, 0) / rows.length;
  if (mean(baseline) - mean(recent) >= 5) {
    if (await awardBadge(admin, userId, 'bp_improver')) return ['bp_improver'];
  }
  return [];
}

/** Perfect Week: BP + exercise + weigh-in all logged within the same ISO week. */
export async function checkPerfectWeekBadge(
  admin: Admin,
  userId: string,
  localDate: string
): Promise<string[]> {
  const week = isoWeekKey(localDate);
  // Compute the week's date span from the log date (Mon–Sun containing it)
  const d = new Date(localDate + 'T00:00:00Z');
  const dow = d.getUTCDay() || 7;
  const monday = addDays(localDate, 1 - dow);
  const sunday = addDays(monday, 6);

  const [bp, ex, wt] = await Promise.all([
    admin
      .from('bp_logs')
      .select('id')
      .eq('user_id', userId)
      .gte('local_date', monday)
      .lte('local_date', sunday)
      .limit(1),
    admin
      .from('exercise_logs')
      .select('id')
      .eq('user_id', userId)
      .gte('local_date', monday)
      .lte('local_date', sunday)
      .limit(1),
    admin.from('weight_logs').select('id').eq('user_id', userId).eq('iso_week', week).limit(1),
  ]);

  if (bp.data?.length && ex.data?.length && wt.data?.length) {
    if (await awardBadge(admin, userId, 'perfect_week')) return ['perfect_week'];
  }
  return [];
}
