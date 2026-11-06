'use client';

import { useActionState, useState } from 'react';
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
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-5 py-14">
      <div className="rounded-2xl border border-hairline bg-white p-7">
        <div
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-subtle-line bg-photo-placeholder"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#111827" strokeWidth="1.8">
            <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
            <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" />
          </svg>
        </div>

        <h1 className="mt-5 text-center text-xl font-bold text-ink">This profile is locked</h1>
        <p className="mt-2 text-center text-sm text-label">Enter the access code from the owner.</p>

        <form
          action={submit}
          className="mt-6 space-y-4"
          noValidate
          onSubmit={() => setSubmitted(true)}
        >
          <input type="hidden" name="slug" value={slug} />
          <label htmlFor="code" className="sr-only">
            8-digit access code
          </label>
          <div className="relative">
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={12} // Allow extra for spaces/dashes
              required
              autoFocus
              placeholder="0000 0000"
              aria-describedby="code-hint"
              onChange={() => setSubmitted(false)}
              className="h-16 w-full rounded-2xl border border-hairline bg-white text-center text-3xl font-bold tracking-[0.2em] text-ink placeholder:text-label/30 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:tracking-[0.4em]"
            />
          </div>
          <p id="code-hint" className="text-center text-xs text-label">
            The code works once and expires after a few minutes.
          </p>

          {state.error && submitted ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
            {pending ? 'Checking…' : 'Unlock'}
          </Button>
        </form>
      </div>
    </div>
  );
}
