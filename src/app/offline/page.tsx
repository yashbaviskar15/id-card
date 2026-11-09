import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff, ArrowUpRight } from 'lucide-react';
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
    <main className="flex min-h-dvh items-center justify-center bg-page px-4 py-8 sm:px-6">
      <section className="surface shadow-card w-full max-w-lg rounded-2xl p-6 sm:p-9">
        <div className="flex items-center gap-3 border-b border-hairline pb-6">
          <BrandMark size={44} />
          <div>
            <p className="text-sm font-semibold text-ink">Private Identity</p>
            <p className="text-xs text-label">Secure contact sharing</p>
          </div>
        </div>
        <div className="pt-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-ink">
            <WifiOff className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-5">Connection unavailable</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">You are offline</h1>
          <p className="mt-2 text-sm leading-6 text-label">
            The app shell is available, but private dashboard pages are not cached for offline
            browsing. Any explicitly queued card or information edits remain in this browser until
            you reconnect.
          </p>
          <div className="mt-5 rounded-xl border border-hairline bg-muted/40 p-4">
            <p className="text-sm font-semibold text-ink">Reconnect to continue</p>
            <p className="mt-1 text-sm leading-6 text-label">
              Sign-in, access codes, share links, file transfers and security settings need a
              connection. Any queued card or information edits will sync after you reconnect.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try again
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
