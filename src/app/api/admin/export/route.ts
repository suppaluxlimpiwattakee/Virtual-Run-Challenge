import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

const EXPORTABLE = [
  'profiles',
  'bp_logs',
  'exercise_logs',
  'weight_logs',
  'points_ledger',
  'raffle_tickets',
  'badges',
  'raffle_draws',
] as const;

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

export async function GET(req: NextRequest) {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const table = req.nextUrl.searchParams.get('table') as (typeof EXPORTABLE)[number] | null;
  if (!table || !EXPORTABLE.includes(table))
    return NextResponse.json({ error: 'Unknown table.' }, { status: 400 });

  // Page through everything (Supabase caps at 1000 rows per request)
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select('*').range(from, from + 999);
    if (error) return NextResponse.json({ error: 'Export failed.' }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${table}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
