import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { requireAdmin } from '@/lib/admin';

// No ambiguous characters (0/O, 1/I/L)
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += CHARSET[randomInt(CHARSET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function GET(req: NextRequest) {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: codes } = await admin
    .from('access_codes')
    .select('id, code, note, used_by, used_at, created_at')
    .order('created_at', { ascending: false });

  const usedBy = [...new Set((codes ?? []).map((c) => c.used_by).filter(Boolean))] as string[];
  const { data: profiles } = usedBy.length
    ? await admin.from('profiles').select('user_id, nickname, full_name').in('user_id', usedBy)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const rows = (codes ?? []).map((c) => ({
    ...c,
    used_by_name: c.used_by
      ? `${byId.get(c.used_by)?.nickname ?? '?'} (${byId.get(c.used_by)?.full_name ?? ''})`
      : null,
  }));

  // CSV download of unused codes for mail-merge distribution
  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const lines = ['code,note,status'];
    for (const c of rows)
      lines.push(`${c.code},${c.note ?? ''},${c.used_by ? 'used' : 'unused'}`);
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="access-codes.csv"',
      },
    });
  }

  return NextResponse.json({ codes: rows });
}

export async function POST(req: NextRequest) {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body.count) || 1, 1), 500);
  const note = typeof body.note === 'string' ? body.note.trim() || null : null;

  const rows = Array.from({ length: count }, () => ({ code: generateCode(), note }));
  const { data, error } = await admin.from('access_codes').insert(rows).select('code');
  if (error) return NextResponse.json({ error: 'Could not generate codes.' }, { status: 500 });
  return NextResponse.json({ ok: true, codes: (data ?? []).map((r) => r.code) });
}

export async function DELETE(req: NextRequest) {
  const { admin } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  // Only unused codes can be deleted
  const { error } = await admin.from('access_codes').delete().eq('id', id).is('used_by', null);
  if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
