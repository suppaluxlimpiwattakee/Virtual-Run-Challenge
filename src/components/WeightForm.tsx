'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { todayLocal } from '@/lib/dates';
import { celebrate } from '@/components/celebrate';
import { BadgeToast } from '@/components/BadgeToast';

export function WeightForm() {
  const router = useRouter();
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ points: number; scoring: boolean } | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch('/api/logs/weight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_kg: weight, local_date: todayLocal() }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not save.');
      return;
    }
    setSaved({ points: data.points, scoring: data.scoring });
    if (data.scoring) celebrate();
    setNewBadges(data.newBadges ?? []);
    router.refresh();
  }

  if (saved) {
    return (
      <div className="animate-pop-in rounded-2xl bg-white p-6 text-center shadow">
        <BadgeToast badges={newBadges} onDone={() => setNewBadges([])} />
        <div className="text-5xl">⚖️</div>
        <p className="mt-2 text-xl font-extrabold">Weigh-in saved!</p>
        <p className="mt-1 text-sm text-foreground/60">
          {saved.scoring
            ? `+${saved.points} points and a raffle ticket 🎟️`
            : 'You already scored a weigh-in this week — this one still counts toward your trend.'}
        </p>
        <button onClick={() => { setSaved(null); setWeight(''); }}
          className="mt-4 rounded-full bg-brand px-6 py-2.5 font-bold text-white">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-center text-xs font-bold text-foreground/60">Weight (kg)</p>
        <input inputMode="decimal" value={weight}
          onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))}
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-5 text-center text-4xl font-extrabold shadow-sm focus:border-brand focus:outline-none"
          placeholder="70.0" />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button onClick={save} disabled={saving || !weight}
        className="w-full rounded-full bg-brand py-4 text-lg font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save weigh-in'}
      </button>
      <p className="text-center text-xs text-foreground/50">
        5 points for one weigh-in per week · scoring weigh-ins earn a raffle ticket
      </p>
    </div>
  );
}
