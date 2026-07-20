'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONVERSIONS, equivalentKm, type ActivityType } from '@/lib/constants';
import { todayLocal } from '@/lib/dates';
import { celebrate } from '@/components/celebrate';
import { BadgeToast } from '@/components/BadgeToast';

const input =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-2xl font-bold shadow-sm focus:border-brand focus:outline-none';

const ACTIVITY_EMOJI: Record<ActivityType, string> = {
  run: '🏃',
  walk: '🚶',
  cycle: '🚴',
  other: '💪',
};

export function ExerciseForm() {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityType>('run');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ points: number; eqKm: number; flagged: boolean } | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [showTable, setShowTable] = useState(false);

  const preview = useMemo(
    () => equivalentKm(activity, Number(distance) || 0, Number(duration) || 0),
    [activity, distance, duration]
  );

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch('/api/logs/exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activity_type: activity,
        distance_km: activity === 'other' ? null : distance,
        duration_min: duration || null,
        local_date: todayLocal(),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not save.');
      return;
    }
    setSaved({ points: data.points, eqKm: data.equivalent_km, flagged: data.flagged });
    celebrate();
    setNewBadges(data.newBadges ?? []);
    router.refresh();
  }

  if (saved) {
    return (
      <div className="animate-pop-in rounded-2xl bg-white p-6 text-center shadow">
        <BadgeToast badges={newBadges} onDone={() => setNewBadges([])} />
        <div className="text-5xl">🎉</div>
        <p className="mt-2 text-xl font-extrabold">+{saved.eqKm} km on the route!</p>
        <p className="mt-1 text-sm text-foreground/60">
          +{saved.points} points and a raffle ticket 🎟️
        </p>
        {saved.flagged && (
          <p className="mt-2 rounded-lg bg-gold/15 px-3 py-2 text-xs text-foreground/70">
            Impressive distance today! Entries over 42 km/day get a quick review by the organizers.
          </p>
        )}
        <button onClick={() => { setSaved(null); setDistance(''); setDuration(''); }}
          className="mt-4 rounded-full bg-brand px-6 py-2.5 font-bold text-white">
          Log another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(ACTIVITY_EMOJI) as ActivityType[]).map((a) => (
          <button key={a} type="button" onClick={() => setActivity(a)}
            className={`flex flex-col items-center rounded-2xl py-3 text-xs font-bold capitalize transition ${
              activity === a ? 'bg-brand text-white shadow-lg' : 'bg-white ring-1 ring-black/10'
            }`}>
            <span className="text-2xl">{ACTIVITY_EMOJI[a]}</span>
            {a}
          </button>
        ))}
      </div>

      {activity !== 'other' && (
        <div>
          <p className="mb-1 text-center text-xs font-bold text-foreground/60">Distance (km)</p>
          <input inputMode="decimal" className={input} value={distance}
            onChange={(e) => setDistance(e.target.value.replace(/[^\d.]/g, ''))} placeholder="5.0" />
        </div>
      )}
      <div>
        <p className="mb-1 text-center text-xs font-bold text-foreground/60">
          Duration (min){activity === 'other' ? '' : ' — optional'}
        </p>
        <input inputMode="numeric" className={input} value={duration}
          onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} placeholder="30" />
      </div>

      {preview > 0 && (
        <div className="animate-pop-in rounded-xl bg-accent/10 px-4 py-3 text-center text-sm">
          = <strong>{preview} equivalent km</strong> → ~{Math.round(preview)} points
        </div>
      )}

      <button type="button" onClick={() => setShowTable((s) => !s)}
        className="w-full text-center text-xs font-semibold text-accent underline">
        How are activities converted?
      </button>
      {showTable && (
        <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
          <table className="w-full">
            <tbody>
              <tr><td className="py-1">🏃 Run</td><td className="text-right">{CONVERSIONS.run.detail}</td></tr>
              <tr><td className="py-1">🚶 Walk</td><td className="text-right">{CONVERSIONS.walk.detail}</td></tr>
              <tr><td className="py-1">🚴 Cycle</td><td className="text-right">{CONVERSIONS.cycle.detail}</td></tr>
              <tr><td className="py-1">💪 Other</td><td className="text-right">{CONVERSIONS.other.detail}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button onClick={save} disabled={saving || preview <= 0}
        className="w-full rounded-full bg-brand py-4 text-lg font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50">
        {saving ? 'Saving…' : 'Log activity'}
      </button>
      <p className="text-center text-xs text-foreground/50">
        1 point per equivalent km · every log = 1 raffle ticket
      </p>
    </div>
  );
}
