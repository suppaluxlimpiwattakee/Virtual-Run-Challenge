/**
 * Seed script — creates demo participants with two months of fake logs.
 * Usage:  npx tsx scripts/seed.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * NOTE: demo users are created via the Supabase Admin API with fake emails and
 * confirmed accounts. They can't sign in via Google, but appear on leaderboards
 * and in the admin panel — perfect for developing the UI.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const DEMO = [
  { nickname: 'SpeedyMina', full_name: 'Mina Demo', sex: 'female' },
  { nickname: 'DocRunner', full_name: 'Somchai Demo', sex: 'male' },
  { nickname: 'HeartHero', full_name: 'Ploy Demo', sex: 'female' },
  { nickname: 'StrollKing', full_name: 'Anan Demo', sex: 'male' },
  { nickname: 'PedalPim', full_name: 'Pim Demo', sex: 'female' },
] as const;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function isoWeekKey(dateS: string): string {
  const d = new Date(dateS + 'T00:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function main() {
  console.log('Seeding demo data…');

  // Challenge window: started 30 days ago, ends in 30 days
  await admin
    .from('app_settings')
    .update({
      challenge_start_date: dateStr(30),
      challenge_end_date: dateStr(-30),
      route_name: 'Run to the Symposium — 1,000 km together',
      route_total_km: 1000,
    })
    .eq('id', 1);

  for (const demo of DEMO) {
    const email = `${demo.nickname.toLowerCase()}@demo.local`;

    // Create (or reuse) the auth user
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID(),
    });
    let userId = created?.user?.id;
    if (userErr) {
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email === email)?.id;
      if (!userId) {
        console.error(`Skipping ${demo.nickname}: ${userErr.message}`);
        continue;
      }
    }

    const baseline = rand(60, 95);
    await admin.from('profiles').upsert({
      user_id: userId,
      full_name: demo.full_name,
      nickname: demo.nickname,
      dob: `19${randInt(60, 95)}-0${randInt(1, 9)}-1${randInt(0, 9)}`,
      sex: demo.sex,
      height_cm: randInt(150, 185),
      weight_kg_baseline: Math.round(baseline * 10) / 10,
      occupation: 'Demo participant',
      institution: 'Demo Hospital',
      consent_at: new Date().toISOString(),
      is_admin: false,
    });

    const activityRate = rand(0.4, 0.95); // how often this demo user logs
    let streak = 0;
    let lastLogged: string | null = null;
    let loggingDays = 0;
    const baseSbp = randInt(118, 150);

    for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
      if (Math.random() > activityRate) continue;
      const localDate = dateStr(daysAgo);
      const ts = new Date(localDate + 'T08:00:00Z').toISOString();
      loggingDays++;
      streak = lastLogged === dateStr(daysAgo + 1) ? streak + 1 : 1;
      lastLogged = localDate;

      // BP log (trending slightly down over the month)
      const sbp = Math.max(100, Math.round(baseSbp - (30 - daysAgo) * 0.3 + rand(-6, 6)));
      const dbp = Math.max(60, Math.round(sbp * 0.63 + rand(-4, 4)));
      const { data: bp } = await admin
        .from('bp_logs')
        .insert({
          user_id: userId, sbp, dbp, pulse: randInt(58, 92), arm: 'L',
          measured_at: ts, local_date: localDate, source: 'manual', is_scoring: true,
        })
        .select('id').single();
      await admin.from('points_ledger').insert({
        user_id: userId, points: 2, reason: 'bp_log', ref_table: 'bp_logs',
        ref_id: bp?.id, ref_date: localDate,
      });
      await admin.from('raffle_tickets').insert({ user_id: userId, source: 'bp_log', ref_id: bp?.id });

      // Exercise (some days)
      if (Math.random() < 0.7) {
        const km = Math.round(rand(2, 9) * 10) / 10;
        const { data: ex } = await admin
          .from('exercise_logs')
          .insert({
            user_id: userId, activity_type: (['run', 'walk', 'cycle'] as const)[randInt(0, 2)],
            distance_km: km, duration_min: Math.round(km * randInt(6, 10)),
            equivalent_km: km, logged_at: ts, local_date: localDate, flagged: false,
          })
          .select('id').single();
        await admin.from('points_ledger').insert({
          user_id: userId, points: Math.round(km), reason: 'exercise',
          ref_table: 'exercise_logs', ref_id: ex?.id, ref_date: localDate,
        });
        await admin.from('raffle_tickets').insert({ user_id: userId, source: 'exercise', ref_id: ex?.id });
      }

      // Weekly weigh-in on Mondays
      const dow = new Date(localDate + 'T00:00:00Z').getUTCDay();
      if (dow === 1) {
        const weight = Math.round((baseline - (30 - daysAgo) * 0.03 + rand(-0.4, 0.4)) * 10) / 10;
        const { data: wt } = await admin
          .from('weight_logs')
          .insert({
            user_id: userId, weight_kg: weight, logged_at: ts, local_date: localDate,
            iso_week: isoWeekKey(localDate), is_scoring: true,
          })
          .select('id').single();
        await admin.from('points_ledger').insert({
          user_id: userId, points: 5, reason: 'weigh_in', ref_table: 'weight_logs',
          ref_id: wt?.id, ref_date: localDate,
        });
        await admin.from('raffle_tickets').insert({ user_id: userId, source: 'weigh_in', ref_id: wt?.id });
      }

      // Streak bonus
      if (streak > 0 && streak % 7 === 0) {
        await admin.from('points_ledger').insert({
          user_id: userId, points: 20, reason: 'streak_bonus', ref_date: localDate,
        });
      }
    }

    await admin
      .from('profiles')
      .update({
        current_streak: streak,
        longest_streak: streak,
        last_log_date: lastLogged,
        logging_days: loggingDays,
      })
      .eq('user_id', userId);

    await admin.from('badges').insert({ user_id: userId, badge_key: 'first_log' });
    if (streak >= 7) await admin.from('badges').insert({ user_id: userId, badge_key: 'streak_7' });

    console.log(`  ✓ ${demo.nickname} (${loggingDays} logging days, streak ${streak})`);
  }

  console.log('Done! Sign in with Google, register, and you will see the demo users on the leaderboard.');
  console.log('To make yourself admin:  update profiles set is_admin = true where nickname = <yours>;');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
