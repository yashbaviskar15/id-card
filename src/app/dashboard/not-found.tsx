import Link from 'next/link';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';
import { ErrorScreen } from '@/components/errors/error-screen';
import { ERROR_CATALOG } from '@/lib/errors/catalog';

/**
 * Unmatched routes under /dashboard (e.g. /dashboard/securi404ty) land here
 * instead of falling through to the root not-found. The root not-found owns its
 * own <main> and min-h-dvh, which would double up with the dashboard layout's
 * <main> and break the layout — so this boundary renders a <div> that sits
 * cleanly inside the dashboard shell.
 */
export default function DashboardNotFound() {
  const entry = ERROR_CATALOG[404];
  return (
    <ErrorScreen
      as="div"
      containerClassName="min-h-[60vh] bg-transparent px-0 py-6 sm:px-0"
      code={entry.code}
      kind={entry.kind}
      title={entry.title}
      description={entry.description}
      hint={entry.hint}
    >
      <Link href="/dashboard" className={cn(buttonVariants(), 'min-h-11')}>
        Back to dashboard
      </Link>
    </ErrorScreen>
  );
}
