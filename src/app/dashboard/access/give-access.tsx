'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Countdown } from '@/components/countdown';
import { createGrantAction, revokeGrantAction } from './actions';
import { initialGrantState } from './form-state';
import type { AccessScope } from '@/lib/types';

/** Ends a grant now; used both under a fresh code and in the grants table. */
export function RevokeButton({
  grantId,
  onRevoked,
  label = 'Revoke',
}: {
  grantId: string;
  onRevoked?: () => void;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const data = new FormData();
          data.set('grant_id', grantId);
          await revokeGrantAction(data);
          onRevoked?.();
          router.refresh();
        })
      }
    >
      {pending ? 'Revoking…' : label}
    </Button>
  );
}

export function GiveAccess({
  defaultScope,
  defaultValidity,
}: {
  defaultScope: AccessScope;
  defaultValidity: number;
}) {
  const [state, submit, pending] = useActionState(createGrantAction, initialGrantState);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  // Keep the grants table underneath in sync whenever a new code is issued.
  useEffect(() => {
    if (state.ok) {
      setDismissed(false);
      setCopied(false);
      router.refresh();
    }
  }, [state, router]);

  const showCode = Boolean(state.ok && state.code) && !dismissed;

  return (
    <section className="rounded-xl border border-hairline bg-white p-6">
      <h2 className="text-base font-bold text-ink">Give access</h2>
      <p className="mt-1 text-sm text-label">
        Create a code and read it out to the person in front of you. It works once.
      </p>

      <form action={submit} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="scope">What it shows</Label>
          <select
            id="scope"
            name="scope"
            defaultValue={defaultScope}
            className="h-9 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
          >
            <option value="contact">Contact only — name, public emails and phones</option>
            <option value="full">Full profile — adds photo, date of birth, address</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="validity_minutes">Valid for (minutes)</Label>
          <Input
            id="validity_minutes"
            name="validity_minutes"
            type="number"
            min={1}
            max={30}
            defaultValue={defaultValidity}
            required
          />
        </div>

        <Button type="submit" className="h-9" disabled={pending}>
          {pending ? 'Creating…' : 'Create code'}
        </Button>

        <div className="sm:col-span-3">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              name="include_documents"
              value="true"
              className="h-4 w-4 rounded border-hairline accent-ink"
            />
            Also show my shared documents
          </label>
          <p className="mt-1 pl-6 text-xs text-label">
            Only documents you have marked “Shared” in the Vault can appear, and only for this code.
          </p>
        </div>
      </form>

      {state.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {showCode ? (
        <div className="mt-5 rounded-xl border border-hairline bg-photo-placeholder p-5 text-center">
          <p className="text-xs font-normal tracking-[0.14em] text-label uppercase">One-time code</p>
          <p className="mt-2 text-4xl font-bold tracking-[0.3em] text-ink tabular-nums">{state.code}</p>
          <p className="mt-3 text-sm text-label">
            Expires in{' '}
            <Countdown
              until={state.expiresAt ?? new Date().toISOString()}
              onExpire={() => {
                setDismissed(true);
                router.refresh();
              }}
              className="font-semibold text-ink"
            />
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!state.code) return;
                try {
                  await navigator.clipboard.writeText(state.code);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy code'}
            </Button>
            {state.grantId ? <RevokeButton grantId={state.grantId} onRevoked={() => setDismissed(true)} /> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
