'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AppSettings, PointEvent } from '@/lib/types';

const input =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 shadow-sm focus:border-brand focus:outline-none';
const label = 'mb-1 block text-sm font-semibold text-foreground/70';
const section = 'text-lg font-bold';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [events, setEvents] = useState<PointEvent[]>([]);
  const [newEvent, setNewEvent] = useState({ name: '', start_date: '', end_date: '', multiplier: 2 });
  const [msg, setMsg] = useState<string | null>(null);
  const [eventMsg, setEventMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => setSettings(data as AppSettings));
    fetch('/api/admin/events')
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []));
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

  async function addEvent() {
    setEventMsg(null);
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    });
    const data = await res.json();
    if (!res.ok) {
      setEventMsg(`❌ ${data.error ?? 'Failed'}`);
      return;
    }
    setEvents((e) => [...e, data.event].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    setNewEvent({ name: '', start_date: '', end_date: '', multiplier: 2 });
    setEventMsg('✅ Event added');
  }

  async function removeEvent(id: string) {
    const res = await fetch(`/api/admin/events?id=${id}`, { method: 'DELETE' });
    if (res.ok) setEvents((e) => e.filter((ev) => ev.id !== id));
  }

  if (!settings) return <p className="text-sm text-foreground/50">Loading…</p>;

  return (
    <div className="max-w-md space-y-8">
      {/* Challenge basics */}
      <div className="space-y-4">
        <h2 className={section}>🏁 Challenge</h2>
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
            ⚡ Manual double points {settings.double_points ? 'ON' : 'off'} (prefer scheduled
            events below)
          </span>
        </label>
      </div>

      {/* Landing page content */}
      <div className="space-y-4">
        <h2 className={section}>🎬 Landing page</h2>
        <p className="text-xs text-foreground/60">
          Paste YouTube links (any format). Leave blank to hide that section on the public page.
        </p>
        <div>
          <label className={label}>Symposium promo video URL</label>
          <input className={input} placeholder="https://www.youtube.com/watch?v=…"
            value={settings.promo_video_url ?? ''}
            onChange={(e) => setSettings({ ...settings, promo_video_url: e.target.value || null })} />
        </div>
        <div>
          <label className={label}>"How to use the app" video URL</label>
          <input className={input} placeholder="https://www.youtube.com/watch?v=…"
            value={settings.howto_video_url ?? ''}
            onChange={(e) => setSettings({ ...settings, howto_video_url: e.target.value || null })} />
        </div>
        <div>
          <label className={label}>Symposium registration link</label>
          <input className={input} placeholder="https://…"
            value={settings.symposium_reg_url ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, symposium_reg_url: e.target.value || null })} />
        </div>
      </div>

      {msg && <p className="text-sm font-semibold">{msg}</p>}
      <button onClick={save} disabled={saving}
        className="rounded-full bg-brand px-8 py-3 font-bold text-white shadow-lg disabled:opacity-60">
        {saving ? 'Saving…' : 'Save settings'}
      </button>

      {/* Point events */}
      <div className="space-y-4 border-t border-black/10 pt-6">
        <h2 className={section}>⚡ Point events</h2>
        <p className="text-xs text-foreground/60">
          Schedule bonus windows in advance — e.g. a mid-point "double points weekend" or a final
          sprint. Points earned on those dates are multiplied automatically.
        </p>
        {events.length > 0 && (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm">
                <div>
                  <span className="font-bold">{ev.name}</span>{' '}
                  <span className="text-foreground/60">
                    {ev.start_date} → {ev.end_date} · ×{ev.multiplier}
                  </span>
                </div>
                <button onClick={() => removeEvent(ev.id)}
                  className="rounded-full px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <label className={label}>Event name</label>
            <input className={input} placeholder="Mid-point Boost Weekend" value={newEvent.name}
              onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={label}>Start</label>
              <input type="date" className={input} value={newEvent.start_date}
                onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })} />
            </div>
            <div>
              <label className={label}>End</label>
              <input type="date" className={input} value={newEvent.end_date}
                onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })} />
            </div>
            <div>
              <label className={label}>Multiplier</label>
              <select className={input} value={newEvent.multiplier}
                onChange={(e) => setNewEvent({ ...newEvent, multiplier: Number(e.target.value) })}>
                {[2, 3, 4, 5].map((m) => (
                  <option key={m} value={m}>×{m}</option>
                ))}
              </select>
            </div>
          </div>
          {eventMsg && <p className="text-sm font-semibold">{eventMsg}</p>}
          <button onClick={addEvent}
            className="rounded-full bg-accent px-6 py-2 text-sm font-bold text-white shadow">
            Add event
          </button>
        </div>
      </div>
    </div>
  );
}
