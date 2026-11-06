'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'cn';
import {
  ArchiveRestore,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Settings2,
  UserRound,
  Vault,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/card', label: 'Card & QR', icon: IdCard },
  { href: '/dashboard/access', label: 'Access', icon: KeyRound },
  { href: '/dashboard/vault', label: 'Vault', icon: Vault },
  { href: '/dashboard/info', label: 'Information', icon: UserRound },
  { href: '/dashboard/backup', label: 'Backup', icon: ArchiveRestore },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings2 },
] as const;

export function NavLinks({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav aria-label="Dashboard mobile" className="flex flex-col gap-1">
        {NAV.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-ink text-white'
                  : 'text-label hover:bg-muted hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Dashboard" className="flex items-center gap-0.5">
      {NAV.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-xs font-semibold transition-colors active:scale-95',
              isActive
                ? 'bg-ink text-white'
                : 'text-label hover:bg-muted hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
