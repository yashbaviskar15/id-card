'use client';

import { useActionState, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { initialFormState } from '@/app/(auth)/form-state';
import { submitAccessCodeAction } from './actions';

/**
 * The only thing an unopened profile ever serves: a code box. Nothing about the
 * owner is rendered here, so no name, photo or detail can reach the HTML or the
 * RSC payload before a code is verified.
 */
export function LockScreen({ slug }: { slug: string }) {
  const [state, submit, pending] = useActionState(submitAccessCodeAction, initialFormState);
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f4f6f8] px-4 py-10 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-ink/5 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-ink/5 blur-3xl" />
      <div className="relative w-full max-w-md">
        <header className="mb-5 flex items-center justify-center gap-3 sm:mb-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-lg font-black text-white">P</span>
          <div>
            <p className="text-sm font-bold text-ink">Private Identity</p>
            <p className="text-xs text-label">Secure contact sharing</p>
          </div>
        </header>

        <section className="rounded-3xl border border-hairline bg-white p-5 shadow-[0_24px_70px_rgba(17,24,39,0.08)] sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-ink">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="mt-5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted/60 px-3 py-1 text-xs font-semibold text-label">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Private access
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Unlock this profile</h1>
            <p className="mt-2 text-sm leading-6 text-label">
              Enter the one-time access code shared with you by the profile owner.
            </p>
          </div>

          <form
            action={submit}
            className="mt-7 space-y-4"
            noValidate
            onSubmit={() => setSubmitted(true)}
          >
            <input type="hidden" name="slug" value={slug} />
            <label htmlFor="code" className="sr-only">8-digit access code</label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={12}
              required
              autoFocus
              placeholder="0000 0000"
              aria-describedby="code-hint"
              aria-invalid={Boolean(state.error && submitted) || undefined}
              onChange={() => setSubmitted(false)}
              className="h-16 w-full rounded-2xl border border-hairline bg-white text-center text-2xl font-bold tracking-[0.24em] text-ink placeholder:text-label/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:text-3xl sm:tracking-[0.4em]"
            />
            <p id="code-hint" className="text-center text-xs leading-5 text-label">
              This code can be used once and expires after a few minutes.
            </p>

            {state.error && submitted ? (
              <Alert variant="destructive" role="alert" className="rounded-xl">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="h-12 w-full rounded-xl text-base font-bold" disabled={pending}>
              {pending ? 'Verifying code…' : 'Unlock profile'}
            </Button>
          </form>
        </section>
        <p className="mt-5 text-center text-xs leading-5 text-label">
          Shared details stay private and are available only for the active session.
        </p>
      </div>
    </main>
  );
}
