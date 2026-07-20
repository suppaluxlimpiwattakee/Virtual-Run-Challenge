'use client';

import { useCallback, useEffect, useState } from 'react';
import { bigCelebrate } from '@/components/celebrate';
import { LuckyWheel, targetRotation, type Entrant } from '@/components/LuckyWheel';

interface Winner {
  nickname: string;
  full_name: string;
  tickets: number;
  prize: string | null;
}

export default function RafflePage() {
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [prize, setPrize] = useState('');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [reveal, setReveal] = useState<Winner | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEntrants = useCallback(async () => {
    const res = await fetch('/api/admin/raffle');
    const data = await res.json();
    if (res.ok) {
      setEntrants(data.entrants);
      setTotalTickets(data.totalTickets);
    }
  }, []);

  useEffect(() => {
    loadEntrants();
  }, [loadEntrants]);

  async function spin() {
    setError(null);
    setReveal(null);
    setSpinning(true);

    const res = await fetch('/api/admin/raffle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1, prize }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSpinning(false);
      setError(data.error ?? 'Draw failed.');
      return;
    }

    const winner: Winner = { ...data.winners[0], prize: prize.trim() || null };
    setRotation((r) => targetRotation(entrants, winner.nickname, r));

    // Reveal when the 5s wheel animation ends
    setTimeout(async () => {
      setSpinning(false);
      setReveal(winner);
      setWinners((w) => [...w, winner]);
      bigCelebrate();
      await loadEntrants(); // winner leaves the wheel for the next spin
    }, 5300);
  }

  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-extrabold">🎡 Lucky Wheel</h2>
      <p className="mt-1 text-sm text-foreground/60">
        {entrants.length} eligible participants · {totalTickets} tickets in the pot. Slice size =
        tickets earned — anyone on the wheel can win!
      </p>

      <div className="mt-6">
        {entrants.length > 0 ? (
          <LuckyWheel entrants={entrants} rotation={rotation} spinning={spinning} />
        ) : (
          <p className="py-16 text-foreground/50">
            No eligible entrants (or everyone has already won). 🎉
          </p>
        )}
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
        <input value={prize} onChange={(e) => setPrize(e.target.value)}
          placeholder="Prize for this spin (optional, e.g. Smart watch)"
          className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center shadow-sm" />
        <button onClick={spin} disabled={spinning || entrants.length === 0}
          className="rounded-full bg-gradient-to-r from-brand to-gold py-4 text-2xl font-extrabold text-white shadow-xl transition active:scale-95 disabled:opacity-50">
          {spinning ? 'Spinning… 🥁' : 'SPIN THE WHEEL 🎉'}
        </button>
      </div>

      {reveal && (
        <div className="animate-pop-in mx-auto mt-8 max-w-md rounded-3xl bg-white p-8 shadow-2xl ring-4 ring-gold">
          <p className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            {reveal.prize ? `Winner — ${reveal.prize}` : 'Winner'}
          </p>
          <p className="mt-2 text-5xl font-extrabold text-brand">🏆 {reveal.nickname}</p>
          <p className="mt-2 text-sm text-foreground/60">
            {reveal.full_name} · {reveal.tickets} tickets
          </p>
        </div>
      )}

      {winners.length > 1 && (
        <div className="mx-auto mt-8 max-w-md text-left">
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/50">
            Winners this session
          </h3>
          <ul className="mt-2 space-y-1">
            {winners.map((w, i) => (
              <li key={i} className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
                🏆 <strong>{w.nickname}</strong> ({w.full_name}){w.prize ? ` — ${w.prize}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-6 font-semibold text-red-600">{error}</p>}

      <p className="mt-8 text-xs text-foreground/40">
        Winners are recorded and leave the wheel automatically, so every spin has fresh suspense.
        Full names shown for prize collection — project responsibly!
      </p>
    </div>
  );
}
