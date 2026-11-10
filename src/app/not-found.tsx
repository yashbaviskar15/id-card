import Link from 'next/link';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';
import { ErrorBackButton } from '@/components/errors/error-back-button';
import { ErrorScreen } from '@/components/errors/error-screen';
import { ERROR_CATALOG } from '@/lib/errors/catalog';

/** Unmatched routes land here; Next answers with a real 404 status. */
export default function NotFound() {
  const entry = ERROR_CATALOG[404];
  return (
    <ErrorScreen
      code={entry.code}
      kind={entry.kind}
      title={entry.title}
      description={entry.description}
      hint={entry.hint}
    >
      <Link href="/" className={cn(buttonVariants(), 'min-h-11')}>
        Go to the home page
      </Link>
      <ErrorBackButton />
    </ErrorScreen>
  );
}
