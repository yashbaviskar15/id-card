'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, CircleUserRound, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { SignOutForm } from '@/components/offline/sign-out-form';

export function UserMenu({
  name,
  email,
  compact = false,
}: {
  name: string;
  email: string | null;
  compact?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || 'U';
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountLinksId = useId();

  useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-label="Open signed-in account menu"
        aria-expanded={accountOpen}
        aria-controls={accountLinksId}
        onClick={() => setAccountOpen((open) => !open)}
        className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink ${
          compact ? 'min-h-16 bg-muted' : 'min-h-12 hover:bg-muted'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-label">Signed in</span>
          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
          <span className="block truncate text-xs text-label">{email ?? 'Account'}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-label transition-transform ${accountOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <nav
        id={accountLinksId}
        aria-label="Account"
        hidden={!accountOpen}
        className="mt-2 grid gap-1 rounded-xl border border-page-border bg-white p-2"
      >
        <Link href="/dashboard/profile" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-ink hover:bg-muted">
          <UserRound className="h-4 w-4" aria-hidden="true" />
          Profile
        </Link>
        <Link href="/dashboard/settings" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-ink hover:bg-muted">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Account settings
        </Link>
        <Link href="/dashboard/security" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-ink hover:bg-muted">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Security
        </Link>
        <SignOutForm>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </SignOutForm>
      </nav>
    </div>
  );
}

export function UserMenuSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2" aria-hidden="true">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-label">
        <CircleUserRound className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 space-y-2">
        <span className="block h-2.5 w-16 animate-pulse rounded bg-muted" />
        <span className={`block h-3 rounded bg-muted ${compact ? 'w-28' : 'w-36'}`} />
      </span>
    </div>
  );
}
