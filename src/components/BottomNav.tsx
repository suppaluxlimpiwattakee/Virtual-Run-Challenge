'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', label: 'Home', emoji: '🏠' },
  { href: '/log', label: 'Log', emoji: '➕' },
  { href: '/leaderboard', label: 'Ranks', emoji: '🏅' },
  { href: '/awards', label: 'Awards', emoji: '🎁' },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-black/5 bg-white/95 backdrop-blur">
      <div className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition ${
                active ? 'text-brand' : 'text-foreground/50'
              }`}>
              <span className={`text-xl ${active ? 'scale-110' : ''}`}>{t.emoji}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
