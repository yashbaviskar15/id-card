import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';
import { ErrorBackButton } from '@/components/errors/error-back-button';
import { ErrorScreen } from '@/components/errors/error-screen';
import { ERROR_CATALOG } from '@/lib/errors/catalog';
import { createShareMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const NO_INDEX = { index: false, follow: false } as const;

function entryFor(raw: string) {
  const code = Number.parseInt(raw, 10);
  return Number.isInteger(code) ? ERROR_CATALOG[code] : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const entry = entryFor(code);
  if (!entry) {
    return createShareMetadata({
      title: 'Page not found',
      description: 'This link does not point at anything here.',
      robots: NO_INDEX,
    });
  }
  return createShareMetadata({
    title: `${entry.code} · ${entry.title}`,
    description: entry.description,
    path: `/error/${entry.code}`,
    robots: NO_INDEX,
  });
}

/**
 * Renders any catalogued error page at a stable URL (`/error/503`). Handy as a
 * preview and as a redirect target for upstream proxies; unknown codes fall
 * through to the real 404. Note App Router pages always answer 200 — the true
 * status codes come from the framework boundaries, not from this route.
 */
export default async function ErrorCatalogPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const entry = entryFor(code);
  if (!entry) notFound();

  const needsSignIn = entry.code === 401 || entry.code === 403;

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
      {needsSignIn ? (
        <Link href="/login" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
          Sign in
        </Link>
      ) : (
        <ErrorBackButton />
      )}
    </ErrorScreen>
  );
}
