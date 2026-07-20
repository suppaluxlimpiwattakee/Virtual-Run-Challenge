'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError('Sign-in failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="animate-pop-in">
        <div className="text-6xl">🏃‍♀️</div>
        <h1 className="mt-4 text-3xl font-extrabold text-brand">Virtual Run Challenge</h1>
        <p className="mt-3 max-w-sm text-sm text-foreground/70">
          Two months of moving, measuring, and momentum before the symposium. Log your blood
          pressure, exercise, and weight — earn points, badges, and raffle tickets!
        </p>
      </div>

      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="mt-10 flex items-center gap-3 rounded-full bg-white px-6 py-3 font-semibold shadow-lg ring-1 ring-black/10 transition active:scale-95 disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 40.4 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
        </svg>
        Sign in with Google
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <p className="mt-12 max-w-xs text-xs text-foreground/50">
        Your health data is private. Leaderboards only ever show your nickname, points, distance,
        and streak.
      </p>
    </main>
  );
}
