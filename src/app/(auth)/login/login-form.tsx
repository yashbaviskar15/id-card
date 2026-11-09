'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signInAction, verifyMfaLoginAction } from '../actions';
import { initialFormState } from '../form-state';
import { createBrowserSupabase } from '@/lib/db/browser';

export function LoginForm({
  next,
  nonce,
  turnstileSiteKey,
  mfaRequired = false,
}: {
  next: string;
  nonce: string;
  turnstileSiteKey: string | null;
  mfaRequired?: boolean;
}) {
  const [state, action, pending] = useActionState(signInAction, initialFormState);
  const [mfaState, mfaAction, mfaPending] = useActionState(verifyMfaLoginAction, initialFormState);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Capability detection only runs in the browser, so the button appears only
  // where the WebAuthn ceremony can actually succeed.
  useEffect(() => {
    setPasskeySupported(
      typeof window !== 'undefined'
        && window.isSecureContext
        && typeof window.PublicKeyCredential !== 'undefined',
    );
  }, []);

  async function signInWithPasskey() {
    setPasskeyError(null);
    setPasskeyPending(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        setPasskeyError('Passkey sign-in did not complete. Try again or use your password.');
        return;
      }
      window.location.assign(next);
    } catch {
      setPasskeyError('Passkey sign-in is not available in this browser.');
    } finally {
      setPasskeyPending(false);
    }
  }

  if (mfaRequired || state.mfaRequired) {
    return (
      <div className="mt-7 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Two-factor verification</h2>
          <p className="mt-1 text-sm text-label">
            Enter the 6-digit code from your authenticator app to finish signing in.
          </p>
        </div>
        <form action={mfaAction} className="space-y-5">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="code" className="font-medium text-ink">Authentication code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              className="h-11 font-mono tracking-widest"
              aria-invalid={Boolean(mfaState.error) || undefined}
            />
          </div>
          {mfaState.error ? (
            <Alert variant="destructive">
              <AlertDescription>{mfaState.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="h-11 w-full font-medium" disabled={mfaPending}>
            {mfaPending ? 'Verifying…' : 'Verify and sign in'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-7 space-y-5">
      <form action={action} className="space-y-5">
        <input type="hidden" name="next" value={next} />

        <div className="space-y-2">
          <Label htmlFor="email" className="font-medium text-ink">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            className="h-11 border-hairline focus:border-ink focus:ring-ink"
            aria-invalid={Boolean(state.error) || undefined}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="font-medium text-ink">Password</Label>
            <Link href="/forgot" className="text-xs text-label transition-colors hover:text-ink">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11 border-hairline focus:border-ink focus:ring-ink"
            aria-invalid={Boolean(state.error) || undefined}
          />
        </div>

        {state.captchaRequired && turnstileSiteKey ? (
          <>
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js"
              strategy="afterInteractive"
              nonce={nonce}
            />
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="light" />
          </>
        ) : null}

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="h-11 w-full font-medium" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {passkeySupported ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-label">
            <span className="h-px flex-1 bg-subtle-line" />
            or
            <span className="h-px flex-1 bg-subtle-line" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full font-medium"
            disabled={passkeyPending}
            onClick={signInWithPasskey}
          >
            <Fingerprint className="mr-2 h-4 w-4" aria-hidden="true" />
            {passkeyPending ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
          </Button>
          {passkeyError ? (
            <Alert variant="destructive">
              <AlertDescription>{passkeyError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
