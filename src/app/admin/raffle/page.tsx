'use client';

import { useState } from 'react';
import { bigCelebrate } from '@/components/celebrate';

interface Winner {
  nickname: string;
  full_name: string;
  tickets: number;
}

export default function RafflePage() {
  const [count, setCount] = useState(1);
  const [prize, setPrize] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [spinnerName, setSpinnerName] = useState<string | null>(null);
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function draw() {
    setError(null);
    setWinners(null);
    setDrawing(true);

    const res = await fetch('/api/admin/raffle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, prize }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDrawing(false);
      setError(data.error ?? 'Draw failed.');
      return;
    }

    // Slot-machine style reveal for the live audience
    const names = ['🎲', '🎰', '✨', '🎲', '🥁', '✨', '🎰', '🥁'];
    let i = 0;
    const spin = setInterval(() => setSpinnerName(names[i++ % names.length]), 120);
    setTimeout(() => {
      clearInterval(spin);
      setSpinnerName(null);
      setWinners(data.winners);
      setDrawing(false);
      bigCelebrate();
    }, 2600);
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="rounded-3xl bg-gradient-to-br from-brand to-gold p-8 text-white shadow-2xl">
        <h2 className="text-3xl font-extrabold">🎟️ Lucky Draw</h2>
        <p className="mt-1 text-sm opacity-90">Weighted by raffle tickets — anyone can win!</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <label className="text-sm font-semibold">Winners:</label>
          <input type="number" min={1} max={20} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 rounded-xl px-3 py-2 text-center text-lg font-bold text-foreground" />
        </div>
        <input value={prize} onChange={(e) => setPrize(e.target.value)}
          placeholder="Prize (optional, e.g. Smart watch)"
          className="mt-3 w-full rounded-xl px-4 py-2.5 text-center text-foreground" />

        <button onClick={draw} disabled={drawing}
          className="mt-6 w-full rounded-full bg-white py-4 text-xl font-extrabold text-brand shadow-lg transition active:scale-95 disabled:opacity-60">
          {drawing ? 'Drawing…' : 'DRAW NOW 🎉'}
        </button>
      </div>

      {spinnerName && (
        <div className="mt-8 text-7xl">{spinnerName}</div>
      )}

      {winners && (
        <div className="mt-8 space-y-3">
          {winners.map((w, i) => (
            <div key={i} className="animate-pop-in rounded-2xl bg-white p-6 shadow-xl"
              style={{ animationDelay: `${i * 0.3}s` }}>
              <p className="text-sm font-semibold text-foreground/50">Winner #{i + 1}</p>
              <p className="mt-1 text-4xl font-extrabold text-brand">🏆 {w.nickname}</p>
              <p className="mt-1 text-sm text-foreground/60">
                {w.full_name} · {w.tickets} tickets
              </p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-6 font-semibold text-red-600">{error}</p>}

      <p className="mt-8 text-xs text-foreground/40">
        Winners are recorded and excluded from future draws by default. Full names are shown here
        for prize collection — project responsibly!
      </p>
    </div>
  );
}
