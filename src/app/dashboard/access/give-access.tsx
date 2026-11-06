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
  sharedCount,
}: {
  defaultScope: AccessScope;
  defaultValidity: number;
  sharedCount: number;
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
          <label className={cn(
            "flex items-center gap-3 rounded-2xl border p-4 transition-colors cursor-pointer",
            sharedCount > 0 ? "border-hairline hover:bg-[#f8f9fa]" : "border-destructive/20 bg-destructive/5"
          )}>
            <input
              type="checkbox"
              name="include_documents"
              value="true"
              defaultChecked={sharedCount > 0}
              disabled={sharedCount === 0}
              className="h-5 w-5 rounded border-hairline text-ink focus:ring-ink"
            />
            <div>
              <span className={cn("text-sm font-black", sharedCount > 0 ? "text-ink" : "text-destructive")}>
                Also show my shared documents
              </span>
              <p className="mt-1 text-xs font-medium text-label">
                {sharedCount > 0
                  ? `Your ${sharedCount} shared document${sharedCount === 1 ? '' : 's'} will be visible for this code.`
                  : "You haven't shared any documents in the Vault yet."}
              </p>
            </div>
          </label>
          {sharedCount === 0 && (
            <Link
              href="/dashboard/vault"
              className="mt-2 inline-block text-[10px] font-black uppercase tracking-widest text-ink underline underline-offset-4"
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
