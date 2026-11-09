'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from 'cn';
import { Copy, Link2 } from 'lucide-react';
import { useOffline } from '@/components/offline/offline-provider';
import { OnlineRequiredNotice } from '@/components/offline/online-notice';
import { createShareLinkAction, revokeShareLinkAction } from './actions';
import { initialShareState } from './form-state';

export interface ShareDocumentOption {
  id: string;
  name: string;
}

export type ShareLinkStatus = 'active' | 'expired' | 'revoked' | 'exhausted';

export interface ShareLinkItem {
  id: string;
  document_name: string;
  created_at: string;
  expires_at: string;
  download_count: number;
  max_downloads: number | null;
  has_password: boolean;
  status: ShareLinkStatus;
}

const STATUS_STYLE: Record<ShareLinkStatus, string> = {
  active: 'border-ink/20 bg-ink text-white',
  expired: 'border-hairline bg-muted text-label',
  revoked: 'border-destructive/30 bg-destructive/5 text-destructive',
  exhausted: 'border-hairline bg-muted text-label',
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RevokeShareButton({ shareId, onRevoked }: { shareId: string; onRevoked?: () => void }) {
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
              const result = await revokeShareLinkAction(shareId);
              if (!result.ok) {
                setError(result.error ?? 'Could not revoke the link.');
                return;
              }
              onRevoked?.();
              router.refresh();
            } catch {
              setError('The revoke request was interrupted. Refresh the list before retrying.');
            }
          })
        }
      >
        {pending ? 'Revoking…' : 'Revoke'}
      </Button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ShareCreator({ documents }: { documents: ShareDocumentOption[] }) {
  const [state, submit, pending] = useActionState(createShareLinkAction, initialShareState);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { online } = useOffline();

  useEffect(() => {
    if (state.ok) {
      setCopied(false);
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <section className="surface shadow-card p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-ink">Create a share link</h2>
      <p className="mt-1 text-sm text-label">
        Hand out one document with a private link. It expires on its own and you can revoke it at any time.
      </p>

      {documents.length === 0 ? (
        <p className="mt-4 text-sm text-label">
          You have no documents yet.{' '}
          <Link href="/dashboard/vault" className="font-medium text-ink underline underline-offset-4">
            Upload one in the Vault
          </Link>{' '}
          first.
        </p>
      ) : (
        <form
          ref={formRef}
          action={submit}
          onSubmit={(event) => {
            if (!online) event.preventDefault();
          }}
          className="mt-5 grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="document_id">Document</Label>
            <select
              id="document_id"
              name="document_id"
              required
              defaultValue=""
              className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none"
            >
              <option value="" disabled>
                Choose a document…
              </option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expires_in_minutes">Expires in (minutes)</Label>
            <Input
              id="expires_in_minutes"
              name="expires_in_minutes"
              type="number"
              min={5}
              max={60 * 24 * 30}
              defaultValue={1440}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max_downloads">Download limit (optional)</Label>
            <Input
              id="max_downloads"
              name="max_downloads"
              type="number"
              min={1}
              max={1000}
              placeholder="No limit"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="password">Password (optional)</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
              placeholder="At least 12 characters"
            />
            <p className="text-xs text-label">
              Leave blank for a link that anyone who has it can open. With a password, the visitor must type it
              first.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" className="h-9" disabled={pending || !online}>
              {pending ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        </form>
      )}

      <OnlineRequiredNotice className="mt-4">
        Share links are created on the server. Reconnect to create or revoke a link.
      </OnlineRequiredNotice>

      {state.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.ok && state.url ? (
        <div className="mt-5 rounded-xl border border-hairline bg-muted/50 p-5">
          <p className="eyebrow">Shareable link</p>
          <p className="mt-2 break-all text-sm font-medium text-ink [overflow-wrap:anywhere]">{state.url}</p>
          <p className="mt-2 text-xs text-label">
            {state.documentName ? `${state.documentName} · ` : ''}
            {state.expiresAt ? `expires ${when(state.expiresAt)}. ` : ''}
            Copy it now — for security this link cannot be shown again after you leave this page.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!state.url) return;
                try {
                  await navigator.clipboard.writeText(state.url);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            {state.shareId ? <RevokeShareButton shareId={state.shareId} /> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ShareLinks({ links }: { links: ShareLinkItem[] }) {
  return (
    <section className="surface shadow-card overflow-hidden">
      <div className="border-b border-subtle-line p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-ink">Your links</h2>
        <p className="mt-1 text-sm text-label">
          The link itself is never stored — only its hash — so it is shown once at creation and cannot be
          recovered here. Revoke any link to stop it working immediately.
        </p>
      </div>

      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-hairline bg-muted/30">
            <Link2 className="h-6 w-6 text-label" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-ink">No share links yet</h3>
          <p className="mt-1 max-w-xs text-sm text-label">
            Create a link above to share one of your documents with someone.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-subtle-line">
          {links.map((link) => (
            <li
              key={link.id}
              className="grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-semibold capitalize',
                      STATUS_STYLE[link.status],
                    )}
                  >
                    {link.status}
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">
                    {link.document_name}
                  </span>
                </div>
                <span className="text-sm text-label">
                  Created {when(link.created_at)} · expires {when(link.expires_at)} ·{' '}
                  {link.download_count}
                  {link.max_downloads !== null ? ` / ${link.max_downloads}` : ''} download
                  {link.download_count === 1 && link.max_downloads === null ? '' : 's'}
                  {link.has_password ? ' · password' : ''}
                </span>
              </div>
              <div className="flex items-center justify-end gap-3">
                {link.status !== 'revoked' ? <RevokeShareButton shareId={link.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
