'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { cn } from 'cn';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorScreen } from '@/components/errors/error-screen';
import { ERROR_CATALOG } from '@/lib/errors/catalog';

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

  const entry = ERROR_CATALOG[500];

  return (
    <ErrorScreen
      code={entry.code}
      kind={entry.kind}
      title={entry.title}
      description={entry.description}
      hint={entry.hint}
      reference={error.digest}
    >
      <Button className="min-h-11" onClick={reset}>
        Try again
      </Button>
      <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
        Go to the home page
      </Link>
    </ErrorScreen>
  );
}
