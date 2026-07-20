import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rows(header: string[], data: Record<string, unknown>[]): string {
  const lines = [header.join(',')];
  for (const r of data) lines.push(header.map((h) => csvEscape(r[h])).join(','));
  return lines.join('\n');
}

/** Participants download their own complete data (RLS-scoped queries). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const [profile, bp, exercise, weight, points, tickets, badges] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('bp_logs').select('local_date, sbp, dbp, pulse, arm, source').eq('user_id', user.id).order('local_date'),
    supabase.from('exercise_logs').select('local_date, activity_type, distance_km, duration_min, equivalent_km').eq('user_id', user.id).order('local_date'),
    supabase.from('weight_logs').select('local_date, weight_kg, is_scoring').eq('user_id', user.id).order('local_date'),
    supabase.from('points_ledger').select('created_at, points, reason').eq('user_id', user.id).order('created_at'),
    supabase.from('raffle_tickets').select('iso_week, goal_key, created_at').eq('user_id', user.id).order('created_at'),
    supabase.from('badges').select('badge_key, earned_at').eq('user_id', user.id).order('earned_at'),
  ]);

  const p = profile.data;
  const sections = [
    '=== MY PROFILE ===',
    rows(
      ['nickname', 'full_name', 'dob', 'sex', 'height_cm', 'weight_kg_baseline', 'position', 'education', 'location', 'institution', 'created_at'],
      p ? [p] : []
    ),
    '',
    '=== BLOOD PRESSURE LOGS ===',
    rows(['local_date', 'sbp', 'dbp', 'pulse', 'arm', 'source'], bp.data ?? []),
    '',
    '=== EXERCISE LOGS ===',
    rows(
      ['local_date', 'activity_type', 'distance_km', 'duration_min', 'equivalent_km'],
      exercise.data ?? []
    ),
    '',
    '=== WEIGHT LOGS ===',
    rows(['local_date', 'weight_kg', 'is_scoring'], weight.data ?? []),
    '',
    '=== POINTS ===',
    rows(['created_at', 'points', 'reason'], points.data ?? []),
    '',
    '=== RAFFLE TICKETS ===',
    rows(['iso_week', 'goal_key', 'created_at'], tickets.data ?? []),
    '',
    '=== BADGES ===',
    rows(['badge_key', 'earned_at'], badges.data ?? []),
  ].join('\n');

  return new NextResponse('﻿' + sections, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="my-virtual-run-data.csv"`,
    },
  });
}
