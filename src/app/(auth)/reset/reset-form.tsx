'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordField } from '@/components/auth/password-field';
import { completeResetAction } from '../actions';
import { initialFormState } from '../form-state';

export function ResetForm() {
  const [state, action, pending] = useActionState(completeResetAction, initialFormState);

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <PasswordField
        name="new_password"
        label="New password"
        autoComplete="new-password"
        showStrength
        autoFocus
      />
      <PasswordField name="confirm_password" label="Confirm new password" autoComplete="new-password" />

      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
