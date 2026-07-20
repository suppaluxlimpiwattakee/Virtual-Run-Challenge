'use client';

import { useState } from 'react';
import { BPForm } from '@/components/BPForm';
import { ExerciseForm } from '@/components/ExerciseForm';
import { WeightForm } from '@/components/WeightForm';

const tabs = [
  { key: 'bp', label: '🩺 Blood pressure' },
  { key: 'exercise', label: '🏃 Exercise' },
  { key: 'weight', label: '⚖️ Weight' },
] as const;

export default function LogPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('bp');

  return (
    <main className="px-5 py-6">
      <h1 className="text-2xl font-extrabold">Log today</h1>
      <div className="mt-4 flex gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full py-2 text-xs font-bold transition ${
              tab === t.key ? 'bg-brand text-white shadow' : 'bg-white ring-1 ring-black/10'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'bp' && <BPForm />}
        {tab === 'exercise' && <ExerciseForm />}
        {tab === 'weight' && <WeightForm />}
      </div>
    </main>
  );
}
