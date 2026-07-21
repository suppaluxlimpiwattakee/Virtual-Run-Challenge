'use client';

import { useCallback, useEffect, useState } from 'react';

interface CodeRow {
  id: string;
  code: string;
  note: string | null;
  used_by: string | null;
  used_by_name: string | null;
  used_at: string | null;
  created_at: string;
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [count, setCount] = useState(20);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('all');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/codes');
    const data = await res.json();
    if (res.ok) setCodes(data.codes);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, note }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(`❌ ${data.error ?? 'Failed'}`);
      return;
    }
    setMsg(`✅ Generated ${data.codes.length} codes`);
    setNote('');
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/codes?id=${id}`, { method: 'DELETE' });
    if (res.ok) setCodes((c) => c.filter((r) => r.id !== id));
  }

  const unused = codes.filter((c) => !c.used_by).length;
  const shown = codes.filter((c) =>
    filter === 'all' ? true : filter === 'used' ? !!c.used_by : !c.used_by
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-bold">🎫 Generate access codes</h2>
        <p className="mt-1 text-xs text-foreground/60">
          Each paid symposium registrant gets one code (e.g. in their confirmation email). A code
          can only be used once. Include it like: &quot;Your Virtual Run Challenge access code:
          <strong> XXXX-XXXX</strong> — join at your-app-url&quot;.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/60">How many</label>
            <input type="number" min={1} max={500} value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-24 rounded-xl border border-black/10 px-3 py-2" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-foreground/60">
              Batch label (optional)
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Early bird registrants"
              className="w-full rounded-xl border border-black/10 px-3 py-2" />
          </div>
          <button onClick={generate} disabled={busy}
            className="rounded-full bg-brand px-6 py-2.5 font-bold text-white shadow disabled:opacity-60">
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm font-semibold">{msg}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <strong>{codes.length}</strong> codes · <strong>{unused}</strong> unused ·{' '}
          <strong>{codes.length - unused}</strong> used
        </p>
        <div className="flex gap-2">
          {(['all', 'unused', 'used'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                filter === f ? 'bg-brand text-white' : 'bg-white ring-1 ring-black/10'
              }`}>
              {f}
            </button>
          ))}
          <a href="/api/admin/codes?format=csv"
            className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-white">
            ⬇ CSV
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/50">
              <th className="p-3">Code</th>
              <th className="p-3">Batch</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="border-b border-black/5">
                <td className="p-3 font-mono font-bold">{c.code}</td>
                <td className="p-3 text-foreground/60">{c.note ?? '—'}</td>
                <td className="p-3">
                  {c.used_by ? (
                    <span className="text-accent">✓ {c.used_by_name}</span>
                  ) : (
                    <span className="text-foreground/40">unused</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {!c.used_by && (
                    <button onClick={() => remove(c.id)}
                      className="rounded-full px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-foreground/40">
                  No codes yet — generate a batch above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
