'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary.
 *
 * Without one, an exception thrown while rendering a server component reaches the
 * browser as an empty document — a blank white page with no explanation. This
 * turns it into something the owner can act on, and keeps the digest so the same
 * failure can be found in the server logs.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The message is deliberately not logged: a failed query could have put
    // personal data in it. The digest is the pointer into the server log.
    console.error(JSON.stringify({ level: 'error', msg: 'route error', digest: error.digest ?? null }));
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page could not be loaded. If this is a fresh deployment, check that every required
          environment variable is set — see SETUP.md.
        </p>       {error.digest ? (
          <p className="mt-4 font-mono text-xs text-label">Reference: {error.digest}</p>
        ) : null}
        <Button className="mt-8 h-11 w-full" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
