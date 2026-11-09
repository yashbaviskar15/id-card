'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { requestPasswordResetAction } from '../actions';
import { initialFormState } from '../form-state';

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialFormState);

  return (
    <form action={action} className="mt-7 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="font-medium text-ink">Account email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-describedby="reset-link-help"
          required
          autoFocus
          className="h-11 border-hairline focus:border-ink focus:ring-ink"
        />
        <p id="reset-link-help" className="text-xs leading-5 text-label">
          The secure link is single-use and expires after 30 minutes. If it expires, request a new one.
        </p>
      </div>

      {state.message ? (
        <Alert role="status">
          <AlertDescription className="leading-5">{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11 w-full font-medium" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a reset link'}
      </Button>

      <p className="text-center text-sm text-label">
        Remember your password?{' '}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
