'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'dashboard route error',
      digest: error.digest ?? null,
    }));
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4 py-10">
      <section className="surface shadow-card w-full rounded-2xl p-6 text-center sm:p-8" role="alert">
        <h1 className="text-xl font-semibold tracking-tight text-ink">This dashboard page could not load</h1>
        <p className="mt-2 text-sm leading-6 text-label">
          Your account is still signed in. Retry the page, or return to the dashboard overview.
        </p>
        {error.digest ? (
          <p className="mt-4 break-all font-mono text-xs text-label">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button className="min-h-11" onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            className="min-h-11"
            render={<Link href="/dashboard" />}
          >
            Dashboard overview
          </Button>
        </div>
      </section>
    </main>
  );
}
