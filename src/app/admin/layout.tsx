import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserAndProfile } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side check against the DB — the is_admin flag can only be set
  // directly in Supabase, never through the app.
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect('/login');
  if (!profile?.is_admin) redirect('/dashboard');

  const tabs = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/participants', label: 'Participants' },
    { href: '/admin/settings', label: 'Settings' },
    { href: '/admin/raffle', label: 'Raffle' },
    { href: '/admin/results', label: 'Results' },
  ];

  return (
    <div className="mx-auto min-h-dvh max-w-4xl px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">
          🛠️ Admin <span className="text-foreground/40">· Virtual Run Challenge</span>
        </h1>
        <Link href="/dashboard" className="text-sm font-semibold text-accent underline">
          ← Back to app
        </Link>
      </header>
      <nav className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-black/10 hover:bg-brand hover:text-white">
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
