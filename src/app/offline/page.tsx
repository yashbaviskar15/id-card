import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * Static fallback served by the service worker when a navigation request fails
 * with no cached page available. It carries no owner data.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-ink">
        <WifiOff className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-ink">You are offline</h1>
        <p className="max-w-sm text-sm leading-6 text-label">
          This page has not been opened on this device yet, so it is not available offline.
          Reconnect and open it once; after that it will work without a connection.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg border border-subtle-line px-4 py-2 text-sm font-medium text-ink hover:bg-muted"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
