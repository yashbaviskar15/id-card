'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'cn';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/card', label: 'Card & QR' },
  { href: '/dashboard/access', label: 'Access' },
  { href: '/dashboard/vault', label: 'Vault' },
  { href: '/dashboard/info', label: 'Information' },
  { href: '/dashboard/backup', label: 'Backup' },
  { href: '/dashboard/settings', label: 'Settings' },
] as const;

export function NavLinks({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav aria-label="Dashboard Mobile" className="flex flex-col gap-1">
        {NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center w-full px-4 py-3 text-base font-bold rounded-xl transition-all',
                isActive
                  ? 'bg-ink text-white shadow-lg shadow-ink/10'
                  : 'text-label hover:bg-muted hover:text-ink'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Dashboard" className="flex items-center gap-1">
      {NAV.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95',
              isActive
                ? 'bg-ink text-white shadow-md shadow-ink/20'
                : 'text-label hover:bg-muted hover:text-ink'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
