import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUserAndProfile } from '@/lib/auth';
import { BottomNav } from '@/components/BottomNav';

// Participant pages are per-user and live — never pre-render at build time.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/register');

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between px-5 pt-5">
        <Link href="/dashboard" className="text-lg font-extrabold text-brand">
          🏃‍♀️ Virtual Run
        </Link>
        <div className="flex items-center gap-3">
          {profile.is_admin && (
            <Link href="/admin" className="text-xs font-semibold text-accent underline">
              Admin
            </Link>
          )}
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
            {profile.nickname}
          </span>
        </div>
      </header>
      <div className="flex-1 pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}
