import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { isValidDateString } from '@/lib/dates';

export async function GET() {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data } = await admin
    .from('point_events')
    .select('*')
    .order('start_date', { ascending: true });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { name, start_date, end_date } = body;
  const mult = Number(body.multiplier ?? 2);

  if (typeof name !== 'string' || name.trim().length < 2)
    return NextResponse.json({ error: 'Event name is required.' }, { status: 400 });
  if (!isValidDateString(start_date) || !isValidDateString(end_date))
    return NextResponse.json({ error: 'Invalid dates.' }, { status: 400 });
  if (end_date < start_date)
    return NextResponse.json({ error: 'End date must not be before start date.' }, { status: 400 });
  if (!Number.isInteger(mult) || mult < 1 || mult > 5)
    return NextResponse.json({ error: 'Multiplier must be 1–5.' }, { status: 400 });

  const { data, error } = await admin
    .from('point_events')
    .insert({ name: name.trim(), start_date, end_date, multiplier: mult })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Could not create event.' }, { status: 500 });
  return NextResponse.json({ ok: true, event: data });
}

export async function DELETE(req: NextRequest) {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing event id.' }, { status: 400 });

  const { error } = await admin.from('point_events').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete event.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
