import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserAndProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AppSettings } from '@/lib/types';

/** Accepts youtube.com/watch?v=, youtu.be/, shorts/, or plain embed URLs. */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return url;
      if (u.pathname.startsWith('/shorts/'))
        return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`;
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    return url; // other providers (Vimeo embed links etc.)
  } catch {
    return null;
  }
}

function VideoCard({ title, url }: { title: string; url: string }) {
  const embed = toEmbedUrl(url);
  if (!embed) return null;
  return (
    <div className="w-full">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-foreground/60">{title}</h3>
      <div className="overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/10">
        <iframe
          src={embed}
          title={title}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

export default async function Home() {
  const { user, profile } = await getUserAndProfile();
  if (user && profile) redirect('/dashboard');
  if (user) redirect('/register');

  // Public page — read display settings with the service client (RLS-safe:
  // only non-sensitive display fields are used here).
  let settings: AppSettings | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('app_settings').select('*').eq('id', 1).maybeSingle();
    settings = data as AppSettings | null;
  } catch {
    // Render without videos if settings are unavailable
  }

  const daysToStart = settings
    ? Math.ceil(
        (new Date(settings.challenge_start_date + 'T00:00:00').getTime() - Date.now()) / 86400000
      )
    : null;

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16">
      {/* Hero */}
      <section className="flex flex-col items-center pt-14 text-center">
        <div className="animate-pop-in text-7xl">🏃‍♀️❤️</div>
        <h1 className="mt-4 text-4xl font-extrabold text-brand">Virtual Run Challenge</h1>
        <p className="mt-3 max-w-md text-foreground/70">
          Two months of moving, measuring, and momentum leading up to the Hypertension Symposium.
          Log your blood pressure, exercise, and weight — earn points, badges, and raffle tickets
          for the live prize draw!
        </p>
        {daysToStart !== null && daysToStart > 0 && (
          <p className="mt-3 rounded-full bg-gold/20 px-4 py-1 text-sm font-semibold">
            🚦 Challenge starts in {daysToStart} day{daysToStart === 1 ? '' : 's'}
          </p>
        )}
        <Link
          href="/login"
          className="mt-8 rounded-full bg-brand px-10 py-4 text-lg font-bold text-white shadow-lg transition active:scale-95"
        >
          Join the challenge →
        </Link>
        <p className="mt-3 text-xs text-foreground/50">Sign in with your Google account</p>
      </section>

      {/* Videos */}
      <section className="mt-14 space-y-8">
        {settings?.promo_video_url && (
          <VideoCard title="About the Hypertension Symposium" url={settings.promo_video_url} />
        )}
        {settings?.howto_video_url && (
          <VideoCard title="How to use this app" url={settings.howto_video_url} />
        )}
      </section>

      {/* Symposium registration */}
      {settings?.symposium_reg_url && (
        <section className="mt-12 rounded-2xl bg-accent/10 p-6 text-center">
          <h2 className="text-xl font-bold">Attending the symposium?</h2>
          <p className="mt-1 text-sm text-foreground/70">
            The challenge winners and the lucky raffle draw will be announced live at the event.
          </p>
          <a
            href={settings.symposium_reg_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-full bg-accent px-8 py-3 font-bold text-white shadow transition active:scale-95"
          >
            Register for the symposium
          </a>
        </section>
      )}

      {/* Prizes */}
      <section className="mt-12">
        <h2 className="text-center text-xl font-bold">🏆 Prizes</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-center shadow ring-1 ring-black/5">
            <div className="text-3xl">🥇</div>
            <p className="mt-1 font-bold">1st place — Male</p>
            <p className="text-xs text-foreground/60">Top distance</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow ring-1 ring-black/5">
            <div className="text-3xl">🥇</div>
            <p className="mt-1 font-bold">1st place — Female</p>
            <p className="text-xs text-foreground/60">Top distance</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow ring-1 ring-black/5">
            <div className="text-3xl">🎁</div>
            <p className="mt-1 font-bold">Everyone</p>
            <p className="text-xs text-foreground/60">Participation souvenir + CME</p>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-foreground/60">
          Plus a lucky raffle draw at the symposium — every weekly goal you hit earns a ticket, so
          steady beats speedy. Anyone can win!
        </p>
      </section>

      <footer className="mt-14 text-center text-xs text-foreground/40">
        Your health data is private. Leaderboards only ever show your nickname, points, distance,
        and streak.
      </footer>
    </main>
  );
}
