'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'cn';
import {
  ArchiveRestore,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Paintbrush,
  Search,
  Share2,
  ShieldCheck,
  Settings2,
  UserRound,
  Vault,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/search', label: 'Search', icon: Search },
  { href: '/dashboard/card', label: 'Card & QR', icon: IdCard },
  { href: '/dashboard/customize', label: 'Customize', icon: Paintbrush },
  { href: '/dashboard/access', label: 'Access', icon: KeyRound },
  { href: '/dashboard/share', label: 'Share links', icon: Share2 },
  { href: '/dashboard/vault', label: 'Vault', icon: Vault },
  { href: '/dashboard/info', label: 'Information', icon: UserRound },
  { href: '/dashboard/backup', label: 'Backup', icon: ArchiveRestore },
  { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings2 },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ layout = 'sidebar' }: { layout?: 'sidebar' | 'sheet' }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className={cn('flex flex-col gap-0.5', layout === 'sheet' && 'gap-1')}
    >
      {NAV.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 font-medium transition-colors',
              layout === 'sheet' ? 'min-h-11 text-sm' : 'min-h-9 text-sm',
              active
                ? 'bg-muted text-ink'
                : 'text-label hover:bg-muted/60 hover:text-ink',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-ink transition-opacity',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
