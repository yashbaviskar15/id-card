'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { cn } from 'cn';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorScreen } from '@/components/errors/error-screen';
import { ERROR_CATALOG } from '@/lib/errors/catalog';

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

  const entry = ERROR_CATALOG[500];

  return (
    <ErrorScreen
      as="div"
      containerClassName="min-h-[60vh] bg-transparent px-0 py-6 sm:px-0"
      code={entry.code}
      kind={entry.kind}
      title="This dashboard page could not load"
      description="Your account is still signed in. Retry the page, or return to the dashboard overview."
      reference={error.digest}
    >
      <Button className="min-h-11" onClick={reset}>
        Try again
      </Button>
      <Link href="/dashboard" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
        Dashboard overview
      </Link>
    </ErrorScreen>
  );
}
