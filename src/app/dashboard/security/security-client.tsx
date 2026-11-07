'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { revokeAllAccessAction } from './actions';

export function SecurityClient({ activeAccessCount }: { activeAccessCount: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function revokeAll() {
    if (!window.confirm('Revoke every active or unused access code now? Open visitor sessions will stop working.')) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await revokeAllAccessAction();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage(`${result.count} access code${result.count === 1 ? '' : 's'} revoked. Visitor sessions have been stopped.`);
      } catch {
        setError('Could not revoke access codes. Check your connection and try again.');
      }
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {error}{' '}
            <Link href="/dashboard/access" className="font-medium underline underline-offset-2">
              Open Access
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      {message ? <Alert role="status"><AlertDescription>{message}</AlertDescription></Alert> : null}

      <section className="surface shadow-card overflow-hidden">
        <div className="flex items-start gap-3 border-b border-subtle-line p-5 sm:p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">Emergency access revocation</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-label">
              Revoke all unused codes and active visitor sessions at once. This cannot be undone;
              share a new code after access has been reviewed.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-label" aria-live="polite">
            {activeAccessCount} code{activeAccessCount === 1 ? '' : 's'} currently valid
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={revokeAll}
            disabled={pending || activeAccessCount === 0}
            className="w-full border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto"
          >
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? 'Revoking…' : 'Revoke all access'}
          </Button>
        </div>
        <p className="border-t border-subtle-line bg-muted/40 px-5 py-3 text-xs leading-5 text-label sm:px-6">
          For safety, this operation requires a recent password confirmation. Your current owner session stays signed in.
        </p>
      </section>

      <section className="surface shadow-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
            <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Review your sharing controls</h2>
            <p className="mt-1 text-sm leading-6 text-label">
              New vault files stay private. Sharing a file and including documents in a visitor code are separate opt-ins.
              Review the current access history and file visibility regularly.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button render={<Link href="/dashboard/access" />} variant="outline" size="sm" className="gap-2">
                Access history <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button render={<Link href="/dashboard/vault" />} variant="outline" size="sm" className="gap-2">
                Review vault <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button render={<Link href="/dashboard/settings" />} variant="outline" size="sm" className="gap-2">
                Account settings <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
