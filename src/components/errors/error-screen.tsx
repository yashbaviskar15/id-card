import type { ReactNode } from 'react';
import { cn } from 'cn';
import { BrandMark } from '@/components/brand/brand-mark';
import type { ErrorKind } from '@/lib/errors/catalog';

export interface ErrorScreenProps {
  code: number;
  kind: ErrorKind;
  title: string;
  description: string;
  hint?: string;
  /** A support reference (e.g. an error digest) shown in mono under the copy. */
  reference?: string;
  /** Action buttons rendered at the foot of the card. */
  children?: ReactNode;
  /** Overrides the outer height, e.g. to sit inside an existing page shell. */
  containerClassName?: string;
  /** Use 'div' when the card already sits inside a page that owns <main>. */
  as?: 'main' | 'div';
}

/**
 * One error card shared by every 4xx/5xx surface — the real boundaries
 * (`not-found.tsx`, `error.tsx`) and the `/error/[code]` pages — so a failure
 * always looks and reads the same to owners, visitors and the auth screens.
 * Presentational only, so it works from both server and client components.
 */
export function ErrorScreen({
  code,
  kind,
  title,
  description,
  hint,
  reference,
  children,
  containerClassName,
  as: Landmark = 'main',
}: ErrorScreenProps) {
  return (
    <Landmark
      className={cn(
        'bg-page flex items-center justify-center px-4 py-12 sm:px-6',
        containerClassName ?? 'min-h-dvh',
      )}
    >
      <section
        className="animate-enter surface shadow-card w-full max-w-md px-6 py-8 text-center sm:px-8"
        role="alert"
      >
        <BrandMark className="mx-auto mb-4" />
        <p className="eyebrow">{kind}</p>
        <p className="tnum mt-3 font-mono text-4xl font-semibold tracking-tight text-ink">{code}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-label">{description}</p>
        {hint ? <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-label/80">{hint}</p> : null}
        {reference ? (
          <p className="mt-4 break-all font-mono text-xs text-label">Reference: {reference}</p>
        ) : null}
        {children ? (
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">{children}</div>
        ) : null}
      </section>
    </Landmark>
  );
}
