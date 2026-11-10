import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand/brand-mark';

export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="bg-page flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="animate-enter w-full max-w-md">
        <header className="mb-6 flex flex-col items-center text-center">
          <BrandMark />
          <p className="eyebrow mt-3">Private Identity</p>
        </header>

        <section className="surface shadow-card p-6 sm:p-8">
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-label">{description}</p>
          </div>
          {children}
        </section>

        <p className="mt-6 text-center text-xs text-label">
          Private Identity Vault · Secure owner access
        </p>
      </div>
    </main>
  );
}
