import type { ReactNode } from 'react';

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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f8f9fa] px-4 py-10 sm:px-6 sm:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-ink/5 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-40 h-[30rem] w-[30rem] rounded-full bg-ink/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <header className="mb-7 flex flex-col items-center text-center sm:mb-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-2xl font-black text-white shadow-lg shadow-ink/15">
            P
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-label">Private Identity</p>
        </header>

        <section className="rounded-3xl border border-hairline bg-white p-6 shadow-[0_24px_70px_rgba(17,24,39,0.08)] sm:p-9">
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-label sm:text-base">{description}</p>
          </div>
          {children}
        </section>

        <p className="mt-6 text-center text-xs font-semibold text-label/60">
          Private Identity Vault · Secure owner access
        </p>
      </div>
    </main>
  );
}
