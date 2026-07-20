import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { isValidDateString } from '@/lib/dates';

export async function PUT(req: NextRequest) {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { challenge_start_date, challenge_end_date, route_name, route_total_km, double_points } =
    body;

  if (!isValidDateString(challenge_start_date) || !isValidDateString(challenge_end_date))
    return NextResponse.json({ error: 'Invalid dates.' }, { status: 400 });
  if (challenge_end_date <= challenge_start_date)
    return NextResponse.json({ error: 'End date must be after start date.' }, { status: 400 });
  if (typeof route_name !== 'string' || !route_name.trim())
    return NextResponse.json({ error: 'Route name is required.' }, { status: 400 });
  const km = Number(route_total_km);
  if (!Number.isFinite(km) || km < 1 || km > 1_000_000)
    return NextResponse.json({ error: 'Route total km must be 1–1,000,000.' }, { status: 400 });

  const { error } = await admin
    .from('app_settings')
    .update({
      challenge_start_date,
      challenge_end_date,
      route_name: route_name.trim(),
      route_total_km: km,
      double_points: double_points === true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
