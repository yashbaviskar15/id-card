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

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/card', label: 'Card & QR', icon: IdCard },
      { href: '/dashboard/info', label: 'Information', icon: UserRound },
      { href: '/dashboard/customize', label: 'Customize', icon: Paintbrush },
      { href: '/dashboard/search', label: 'Search', icon: Search },
    ],
  },
  {
    label: 'Sharing',
    items: [
      { href: '/dashboard/access', label: 'Access', icon: KeyRound },
      { href: '/dashboard/share', label: 'Share links', icon: Share2 },
      { href: '/dashboard/vault', label: 'Vault', icon: Vault },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
      { href: '/dashboard/backup', label: 'Backup', icon: ArchiveRestore },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings2 },
    ],
  },
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
      className="space-y-5"
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-label/65">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  layout === 'sheet' && 'min-h-11',
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
        </div>
      ))}
    </nav>
  );
}
