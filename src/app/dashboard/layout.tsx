import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/card', label: 'Card & QR' },
  { href: '/dashboard/access', label: 'Access' },
  { href: '/dashboard/vault', label: 'Vault' },
  { href: '/dashboard/info', label: 'Information' },
  { href: '/dashboard/backup', label: 'Backup' },
  { href: '/dashboard/settings', label: 'Settings' },
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The OWNER_EMAIL allow-list and the session are re-checked here on the server
  // for every dashboard request — never trusted from client state.
  const owner = await requireOwner();

  return (
    <div className="min-h-dvh bg-background">
      <header className="no-print sticky top-0 z-10 border-b border-hairline bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="text-[15px] font-bold tracking-tight text-ink">
            Private Identity Card
          </Link>
          <nav aria-label="Dashboard" className="flex flex-1 items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-label hover:bg-muted hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-label sm:inline">{owner.email}</span>
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
