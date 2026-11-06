import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { NavLinks } from './nav-links';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The OWNER_EMAIL allow-list and the session are re-checked here on the server
  // for every dashboard request — never trusted from client state.
  const owner = await requireOwner();

  return (
    <div className="min-h-dvh bg-background">
      <header className="no-print sticky top-0 z-20 border-b border-hairline bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-y-4 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-x-6">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-lg font-bold tracking-tight text-ink">
              Private Identity Card
            </Link>
            <div className="flex items-center gap-3 md:hidden">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md border border-hairline px-2.5 py-1 text-xs font-semibold text-ink hover:bg-muted"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          
          <div className="flex flex-1 items-center gap-4 overflow-hidden">
            <NavLinks />
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <span className="text-xs text-label">{owner.email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-hairline px-3 py-1.5 text-sm font-semibold text-ink hover:bg-muted"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
