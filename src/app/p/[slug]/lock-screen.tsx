'use client';

import { useActionState, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
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
    <main className="bg-page flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <header className="mb-6 flex items-center justify-center gap-3">
          <BrandMark size={40} />
          <div className="text-left">
            <p className="text-sm font-semibold text-ink">Private Identity</p>
            <p className="text-xs text-label">Secure contact sharing</p>
          </div>
        </header>

        <section className="surface shadow-card p-6 sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-ink">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="mt-5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted/60 px-3 py-1 text-xs font-medium text-label">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Private access
            </span>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">Unlock this profile</h1>
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
              className="tnum h-16 w-full rounded-xl border border-hairline bg-white text-center text-2xl font-semibold tracking-[0.24em] text-ink placeholder:text-label/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:text-3xl sm:tracking-[0.4em]"
            />
            <p id="code-hint" className="text-center text-xs leading-5 text-label">
              This code can be used once and expires after a few minutes.
            </p>

            {state.error && submitted ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="h-11 w-full font-medium" disabled={pending}>
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
