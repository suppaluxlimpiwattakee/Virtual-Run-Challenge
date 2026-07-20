'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AppSettings } from '@/lib/types';

const input =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 shadow-sm focus:border-brand focus:outline-none';
const label = 'mb-1 block text-sm font-semibold text-foreground/70';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => setSettings(data as AppSettings));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? '✅ Saved!' : `❌ ${data.error ?? 'Failed to save'}`);
  }

  if (!settings) return <p className="text-sm text-foreground/50">Loading…</p>;

  return (
    <div className="max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Challenge start</label>
          <input type="date" className={input} value={settings.challenge_start_date}
            onChange={(e) => setSettings({ ...settings, challenge_start_date: e.target.value })} />
        </div>
        <div>
          <label className={label}>Challenge end</label>
          <input type="date" className={input} value={settings.challenge_end_date}
            onChange={(e) => setSettings({ ...settings, challenge_end_date: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label}>Route name</label>
        <input className={input} value={settings.route_name}
          onChange={(e) => setSettings({ ...settings, route_name: e.target.value })} />
      </div>
      <div>
        <label className={label}>Route total km (collective goal)</label>
        <input type="number" min={1} className={input} value={settings.route_total_km}
          onChange={(e) => setSettings({ ...settings, route_total_km: Number(e.target.value) })} />
      </div>
      <label className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
        <input type="checkbox" className="h-5 w-5 accent-brand" checked={settings.double_points}
          onChange={(e) => setSettings({ ...settings, double_points: e.target.checked })} />
        <span className="text-sm font-semibold">
          ⚡ Double points {settings.double_points ? 'ON' : 'off'} (e.g. mid-point weekend)
        </span>
      </label>

      {msg && <p className="text-sm font-semibold">{msg}</p>}

      <button onClick={save} disabled={saving}
        className="rounded-full bg-brand px-8 py-3 font-bold text-white shadow-lg disabled:opacity-60">
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}
