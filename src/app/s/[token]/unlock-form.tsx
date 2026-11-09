'use client';

import { useActionState, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BrandMark } from '@/components/brand/brand-mark';
import { initialFormState } from '@/app/(auth)/form-state';
import { unlockShareAction } from './actions';

/**
 * The only thing a password-protected share link ever serves before the
 * password is entered: a password box. Nothing about the owner or the document
 * is rendered here, so no name can reach the HTML or the RSC payload.
 */
export function UnlockForm({ token }: { token: string }) {
  const [state, submit, pending] = useActionState(unlockShareAction, initialFormState);
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      action={submit}
      className="mt-7 space-y-4"
      noValidate
      onSubmit={() => setSubmitted(true)}
    >
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <label htmlFor="password" className="sr-only">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="off"
          required
          autoFocus
          aria-invalid={Boolean(state.error && submitted) || undefined}
          onChange={() => setSubmitted(false)}
          className="h-12 w-full rounded-xl border border-hairline bg-white px-4 text-base text-ink placeholder:text-label/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />
      </div>

      {state.error && submitted ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11 w-full font-medium" disabled={pending}>
        {pending ? 'Checking…' : 'Unlock'}
      </Button>
    </form>
  );
}

/** Small presentational shell shared by the password and download states. */
export function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-page flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <header className="mb-6 flex items-center justify-center gap-3">
          <BrandMark />
          <div className="text-left">
            <p className="text-sm font-semibold text-ink">Private Identity</p>
            <p className="text-xs text-label">Secure file sharing</p>
          </div>
        </header>
        <section className="surface shadow-card p-6 sm:p-8">{children}</section>
      </div>
    </main>
  );
}

export function UnlockHeading() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-ink">
        <LockKeyhole className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="mt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted/60 px-3 py-1 text-xs font-medium text-label">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Password protected
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">Enter the password</h1>
        <p className="mt-2 text-sm leading-6 text-label">
          This link is protected. Enter the password you were given to open it.
        </p>
      </div>
    </div>
  );
}
