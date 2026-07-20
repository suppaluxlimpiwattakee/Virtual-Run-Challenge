'use client';

import { useEffect } from 'react';
import { bigCelebrate } from '@/components/celebrate';

const MILESTONES = [25, 50, 75, 100];

export function RouteProgress({
  totalKm,
  routeTotalKm,
  routeName,
  participants,
}: {
  totalKm: number;
  routeTotalKm: number;
  routeName: string;
  participants: number;
}) {
  const pct = Math.min(100, Math.round((totalKm / routeTotalKm) * 1000) / 10);

  // Confetti when the community crosses a new milestone since this device last looked
  useEffect(() => {
    const key = 'route-milestone-seen';
    const seen = Number(localStorage.getItem(key) ?? 0);
    const reached = MILESTONES.filter((m) => pct >= m).pop() ?? 0;
    if (reached > seen) {
      bigCelebrate();
      localStorage.setItem(key, String(reached));
    }
  }, [pct]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">🗺️ {routeName}</h2>
      <p className="mt-0.5 text-xs text-foreground/50">
        {participants} participants · {totalKm.toLocaleString()} / {routeTotalKm.toLocaleString()} km together
      </p>
      <div className="relative mt-4 h-5 overflow-hidden rounded-full bg-black/5">
        <div className="animate-progress h-full rounded-full bg-gradient-to-r from-accent to-brand"
          style={{ width: `${pct}%` }} />
        {MILESTONES.map((m) => (
          <div key={m}
            className="absolute top-0 h-full w-0.5 bg-white/80"
            style={{ left: `${m}%` }} />
        ))}
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-foreground/80">
          {pct}%
        </span>
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-foreground/40">
        <span>🚩 Start</span>
        <span>¼</span>
        <span>½</span>
        <span>¾</span>
        <span>🏛️ Symposium</span>
      </div>
    </section>
  );
}
