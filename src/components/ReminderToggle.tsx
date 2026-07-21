'use client';

import { useState } from 'react';

export function ReminderToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setOn(next); // optimistic
    const res = await fetch('/api/me/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_reminders: next }),
    });
    if (!res.ok) setOn(!next); // revert on failure
    setBusy(false);
  }

  return (
    <button onClick={toggle} disabled={busy}
      className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm disabled:opacity-60">
      <span className="text-sm">
        <strong>📧 Email reminders</strong>
        <span className="block text-xs text-foreground/60">
          A friendly nudge if you haven&apos;t logged for a few days (max 1/week)
        </span>
      </span>
      <span className={`relative inline-block h-7 w-12 rounded-full transition ${
          on ? 'bg-accent' : 'bg-black/15'
        }`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            on ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
          }`} />
      </span>
    </button>
  );
}
