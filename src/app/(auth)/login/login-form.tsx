'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signInAction } from '../actions';
import { initialFormState } from '../form-state';

export function LoginForm({
  next,
  nonce,
  turnstileSiteKey,
}: {
  next: string;
  nonce: string;
  turnstileSiteKey: string | null;
}) {
  const [state, action, pending] = useActionState(signInAction, initialFormState);

  return (
    <form action={action} className="mt-7 space-y-5">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2.5">
        <Label htmlFor="email" className="text-sm font-semibold text-ink">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          className="h-12 rounded-xl border-hairline focus:border-ink focus:ring-ink"
          aria-invalid={Boolean(state.error) || undefined}
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-label">Password</Label>
          <Link href="/forgot" className="text-[10px] font-bold uppercase tracking-widest text-label/60 hover:text-ink transition-colors">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-xl border-hairline focus:border-ink focus:ring-ink"
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
        <Alert variant="destructive" className="rounded-2xl border-2">
          <AlertDescription className="font-bold">{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-14 w-full rounded-2xl text-lg font-black shadow-lg shadow-ink/10 transition-all active:scale-95" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
