'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from 'cn';
import { Countdown } from '@/components/countdown';
import { useOffline } from '@/components/offline/offline-provider';
import { OnlineRequiredNotice } from '@/components/offline/online-notice';
import { createGrantAction, revokeGrantAction } from './actions';
import { initialGrantState } from './form-state';
import type { AccessScope } from '@/lib/types';
import type { GrantFormState } from './form-state';

async function submitGrantSafely(previousState: GrantFormState, formData: FormData): Promise<GrantFormState> {
  try {
    return await createGrantAction(previousState, formData);
  } catch {
    return {
      ok: false,
      error: 'Connection interrupted before the code was confirmed. Check Access History before retrying.',
    };
  }
}

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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { online } = useOffline();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || !online}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const data = new FormData();
              data.set('grant_id', grantId);
              const result = await revokeGrantAction(data);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onRevoked?.();
              router.refresh();
            } catch {
              setError('Connection interrupted. Check Access History before retrying.');
            }
          })
        }
      >
        {pending ? 'Revoking…' : label}
      </Button>
      {error ? <span role="alert" className="max-w-48 text-right text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

export function GiveAccess({
  defaultScope,
  defaultValidity,
  sharedCount,
}: {
  defaultScope: AccessScope;
  defaultValidity: number;
  sharedCount: number;
}) {
  const [state, submit, pending] = useActionState(submitGrantSafely, initialGrantState);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  const { online } = useOffline();

  // Keep the grants table underneath in sync whenever a new code is issued.
  useEffect(() => {
    if (state.ok) {
      setDismissed(false);
      setCopied(false);
      router.refresh();
    }
  }, [router, state]);

  const showCode = Boolean(state.ok && state.code) && !dismissed;

  return (
    <section className="surface shadow-card p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-ink">Give access</h2>
      <p className="mt-1 text-sm text-label">
        Create a code and read it out to the person in front of you. It works once.
      </p>

      <form
        action={submit}
        onSubmit={(event) => {
          if (!online) event.preventDefault();
        }}
        className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="scope">What it shows</Label>
          <select
            id="scope"
            name="scope"
            defaultValue={defaultScope}
            className="h-9 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
          >
            <option value="contact">Contact only — name, public contact details and shared links</option>
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

        <Button type="submit" className="h-9" disabled={pending || !online}>
          {pending ? 'Creating…' : 'Create code'}
        </Button>

        <div className="sm:col-span-3">
          <label className={cn(
            "flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition-colors",
            sharedCount > 0 ? "border-hairline hover:bg-muted/40" : "border-destructive/25 bg-destructive/5"
          )}>
            <input
              type="checkbox"
              name="include_documents"
              value="true"
              defaultChecked={false}
              disabled={sharedCount === 0}
              className="h-4 w-4 rounded border-hairline text-ink focus:ring-ink"
            />
            <div>
              <span className={cn("text-sm font-medium", sharedCount > 0 ? "text-ink" : "text-destructive")}>
                Also show my shared documents
              </span>
              <p className="mt-0.5 text-xs text-label">
                {sharedCount > 0
                  ? `Off by default. Select this only if you want to include your ${sharedCount} shared document${sharedCount === 1 ? '' : 's'}.`
                  : "You haven't shared any documents in the Vault yet."}
              </p>
            </div>
          </label>
          {sharedCount === 0 && (
            <Link
              href="/dashboard/vault"
              className="mt-2 inline-block text-xs font-medium text-ink underline underline-offset-4"
            >
              Go to Vault to share documents
            </Link>
          )}
        </div>
      </form>

      {state.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <OnlineRequiredNotice className="mt-4">
        Access codes are generated on the server. Reconnect to create or revoke a code.
      </OnlineRequiredNotice>

      {showCode ? (
        <div className="mt-5 rounded-xl border border-hairline bg-muted/50 p-5 text-center">
          <p className="eyebrow">One-time code</p>
          <p className="tnum mt-2 text-4xl font-semibold tracking-[0.3em] text-ink">{state.code}</p>
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
          <p className="mt-2 text-xs text-label">
            Copy or share it now. For security, this code cannot be recovered after you leave or refresh this page.
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
