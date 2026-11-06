import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { NavLinks } from './nav-links';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The OWNER_EMAIL allow-list and the session are re-checked here on the server
  // for every dashboard request — never trusted from client state.
  const owner = await requireOwner();

  return (
    <div className="min-h-dvh bg-[#f8f9fa]">
      <header className="no-print sticky top-0 z-20 border-b border-hairline bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-y-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:gap-x-8">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="group flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-ink flex items-center justify-center text-white font-bold text-xl transition-transform group-hover:scale-105">P</div>
              <span className="text-xl font-black tracking-tighter text-ink">
                Identity
              </span>
            </Link>
            <div className="flex items-center gap-3 md:hidden">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-full bg-muted px-4 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-ink hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          
          <div className="flex flex-1 items-center gap-4 overflow-hidden">
            <NavLinks />
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-label uppercase tracking-widest">Account</span>
              <span className="text-sm font-bold text-ink">{owner.email}</span>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full border-2 border-ink px-5 py-2 text-sm font-black text-ink transition-all hover:bg-ink hover:text-white active:scale-95"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
