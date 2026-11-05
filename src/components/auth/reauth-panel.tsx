'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { reauthAction } from '@/app/(auth)/actions';
import { initialFormState } from '@/app/(auth)/form-state';

/**
 * Shown in place of a sensitive control until the owner has re-entered their
 * password. The unlock lasts 5 minutes and is enforced on the server, not here.
 */
export function ReauthPanel({ action }: { action: string }) {
  const [state, submit, pending] = useActionState(reauthAction, initialFormState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <section className="rounded-xl border border-hairline bg-white p-6">
      <h2 className="text-base font-bold text-ink">Confirm it is you</h2>
      <p className="mt-1 text-sm text-label">
        Enter your password to {action}. This stays unlocked for 5 minutes.
      </p>

      <form action={submit} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end" noValidate>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="reauth-password">Password</Label>
          <Input
            id="reauth-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-9"
          />
        </div>
        <Button type="submit" className="h-9" disabled={pending}>
          {pending ? 'Checking…' : 'Unlock'}
        </Button>
      </form>

      {state.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
