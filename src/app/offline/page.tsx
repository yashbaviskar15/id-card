import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * Fallback page for the offline experience. The service worker serves a
 * self-contained screen for any navigation that fails, so no owner data is
 * ever cached; this route is the in-app equivalent used when it is reachable.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <BrandMark size={56} />
      <div className="space-y-2">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-ink">
          <WifiOff className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold text-ink">You are offline</h1>
        <p className="mx-auto max-w-sm text-sm leading-6 text-label">
          The app is installed and ready, but your private account data and server actions need
          an internet connection. Reconnect to load your dashboard and safely sync any changes.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg border border-subtle-line px-4 py-2 text-sm font-medium text-ink hover:bg-muted"
      >
        Try again
      </Link>
    </main>
  );
}
