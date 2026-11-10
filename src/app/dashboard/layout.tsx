import Link from 'next/link';
import { Suspense } from 'react';
import { requireOwner } from '@/lib/auth/session';
import { NavLinks } from './nav-links';
import { DashboardUserMenu } from './dashboard-user-menu';
import { UserMenuSkeleton } from './user-menu';
import { DashboardLiveSync } from '@/components/dashboard/live-sync';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();

  return (
    <div className="min-h-dvh bg-page">
      <DashboardLiveSync />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-page-border bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-page-border px-5">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-ink">Private Identity</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <NavLinks layout="sidebar" />
        </div>

        <div className="border-t border-page-border p-3">
          <Suspense fallback={<UserMenuSkeleton />}>
            <DashboardUserMenu owner={owner} />
          </Suspense>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b border-page-border bg-white/85 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight text-ink">Private Identity</span>
          </Link>
          <Sheet>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" aria-label="Open navigation" />}
            >
              <Menu className="h-5 w-5 text-ink" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,calc(100vw-1rem))] gap-0 p-0">
              <SheetHeader className="border-b border-page-border p-5 text-left">
                <SheetTitle className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
                  <BrandMark />
                  Private Identity
                </SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  <NavLinks layout="sheet" />
                </div>
                <div className="border-t border-page-border p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
                  <Suspense fallback={<UserMenuSkeleton compact />}>
                    <DashboardUserMenu owner={owner} />
                  </Suspense>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="mx-auto w-full max-w-[1600px] min-w-0 overflow-x-clip px-4 py-5 sm:px-5 sm:py-6 lg:px-6 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
