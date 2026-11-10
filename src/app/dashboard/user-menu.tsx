'use client';

import Link from 'next/link';
import { ChevronDown, CircleUserRound, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { SignOutForm } from '@/components/offline/sign-out-form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserMenu({ name, email }: { name: string; email: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open signed-in account menu"
        className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ink"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-label">Signed in</span>
          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
          <span className="block truncate text-xs text-label">{email ?? 'Account'}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-label" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-1.5rem))] p-2">
        <DropdownMenuLabel className="px-3 py-2">
          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
          <span className="mt-0.5 block truncate text-xs font-normal text-label">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/profile" />} className="min-h-10 px-3">
          <UserRound className="h-4 w-4" aria-hidden="true" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/settings" />} className="min-h-10 px-3">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/security" />} className="min-h-10 px-3">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Security
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SignOutForm>
          <DropdownMenuItem
            variant="destructive"
            render={<button type="submit" />}
            className="min-h-10 px-3"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </SignOutForm>
      </DropdownMenuContent>
    </DropdownMenu>
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
