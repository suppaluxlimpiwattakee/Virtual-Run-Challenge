'use client';

import { useEffect } from 'react';
import { BADGES } from '@/lib/constants';
import { bigCelebrate } from '@/components/celebrate';

export function BadgeToast({ badges, onDone }: { badges: string[]; onDone: () => void }) {
  useEffect(() => {
    if (badges.length) {
      bigCelebrate();
      const t = setTimeout(onDone, 4000);
      return () => clearTimeout(t);
    }
  }, [badges, onDone]);

  if (!badges.length) return null;
  return (
    <div className="fixed inset-x-4 top-6 z-50 mx-auto max-w-sm animate-pop-in rounded-2xl bg-gold px-5 py-4 text-center shadow-2xl">
      <p className="text-sm font-bold text-white">New badge{badges.length > 1 ? 's' : ''}!</p>
      {badges.map((key) => {
        const b = BADGES[key];
        return (
          <p key={key} className="mt-1 text-lg font-extrabold text-white">
            {b?.emoji} {b?.label ?? key}
          </p>
        );
      })}
    </div>
  );
}
