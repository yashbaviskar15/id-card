import { Suspense } from 'react';
import { requireOwner } from '@/lib/auth/session';
import { NavLinks } from './nav-links';
import { DashboardUserMenu } from './dashboard-user-menu';
import { UserMenuSkeleton } from './user-menu';
import { MobileDashboardNav } from './mobile-dashboard-nav';
import { DashboardLiveSync } from '@/components/dashboard/live-sync';
import { PageTransition } from './page-transition';
import { BrandMark } from '@/components/brand/brand-mark';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();

  return (
    <div className="dashboard-shell min-h-dvh bg-page">
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

        <div className="space-y-3 border-t border-page-border p-3">
          <div className="space-y-2 px-1">
            <p className="eyebrow px-2">Appearance</p>
            <ThemeToggle />
          </div>
          <div className="border-t border-page-border" />
          <Suspense fallback={<UserMenuSkeleton />}>
            <DashboardUserMenu owner={owner} />
          </Suspense>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <MobileDashboardNav
          themeToggle={<ThemeToggle />}
          accountMenu={
            <Suspense fallback={<UserMenuSkeleton compact />}>
              <DashboardUserMenu owner={owner} compact />
            </Suspense>
          }
        />

        <main className="mx-auto w-full max-w-[1600px] min-w-0 overflow-x-clip px-4 py-5 sm:px-5 sm:py-6 lg:px-6 lg:py-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
