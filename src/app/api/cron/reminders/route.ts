import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { daysBetween } from '@/lib/dates';

// Daily cron (see vercel.json). Emails opted-in participants who haven't
// logged for 3+ days — at most one email per person per 6 days.
// Requires: CRON_SECRET (auth) and RESEND_API_KEY (sending) env vars.

const QUIET_DAYS = 3;
const THROTTLE_DAYS = 6;

async function sendEmail(to: string, nickname: string, siteUrl: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM ?? 'Virtual Run Challenge <onboarding@resend.dev>',
      to: [to],
      subject: `${nickname}, your streak misses you! 🏃`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#e85d3d">Hi ${nickname}! 👋</h2>
          <p>It's been a few days since your last log in the <strong>Virtual Run Challenge</strong>.</p>
          <p>Just one blood pressure reading, walk, or weigh-in keeps you moving toward this
          week's raffle tickets — and remember, one rest day per week won't break your streak. 🛡️</p>
          <p style="margin:28px 0">
            <a href="${siteUrl}/log"
               style="background:#e85d3d;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:bold">
              Log something now →
            </a>
          </p>
          <p style="font-size:12px;color:#888">
            You're receiving this because you opted in to reminders. Turn them off anytime from
            your dashboard.
          </p>
        </div>`,
    }),
  });
  return res.ok;
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dryRun = new URL(req.url).searchParams.get('dry') === '1';
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  // Only remind during an active challenge
  const { data: settings } = await admin.from('app_settings').select('*').eq('id', 1).single();
  if (!settings || today < settings.challenge_start_date || today > settings.challenge_end_date)
    return NextResponse.json({ sent: 0, reason: 'challenge not active' });

  const { data: profiles } = await admin
    .from('profiles')
    .select('user_id, nickname, last_log_date, last_reminder_at')
    .eq('email_reminders', true);

  const due = (profiles ?? []).filter((p) => {
    const quiet = !p.last_log_date || daysBetween(p.last_log_date, today) >= QUIET_DAYS;
    const throttled =
      p.last_reminder_at &&
      (now - new Date(p.last_reminder_at).getTime()) / 86400000 < THROTTLE_DAYS;
    return quiet && !throttled;
  });

  if (dryRun)
    return NextResponse.json({ dryRun: true, wouldEmail: due.map((p) => p.nickname) });

  if (!process.env.RESEND_API_KEY)
    return NextResponse.json(
      { sent: 0, reason: 'RESEND_API_KEY not configured', due: due.length },
      { status: 200 }
    );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  let sent = 0;
  for (const p of due) {
    // Email lives in Supabase Auth, not in profiles
    const { data: userData } = await admin.auth.admin.getUserById(p.user_id);
    const email = userData?.user?.email;
    if (!email) continue;
    if (await sendEmail(email, p.nickname, siteUrl)) {
      sent++;
      await admin
        .from('profiles')
        .update({ last_reminder_at: new Date().toISOString() })
        .eq('user_id', p.user_id);
    }
  }

  return NextResponse.json({ sent, eligible: due.length });
}
