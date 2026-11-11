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
import { createGrantAction, revokeGrantAction, saveQuickPresetAction, deleteQuickPresetAction } from './actions';
import { initialGrantState } from './form-state';
import type { AccessScope } from '@/lib/types';
import type { QuickPreset } from '@/lib/access/presets';
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

/**
 * Manages the owner's one-click presets. Rendered outside the main form so the
 * nested form is valid HTML.
 */
function PresetManager({ presets }: { presets: QuickPreset[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { online } = useOffline();
  const ownPresets = presets.filter((preset) => !preset.id.startsWith('default-'));

  function save(formData: FormData) {
    startTransition(async () => {
      setError(null);
      try {
        const result = await saveQuickPresetAction(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError('Connection interrupted. Try again.');
      }
    });
  }

  function remove(presetId: string) {
    startTransition(async () => {
      setError(null);
      try {
        const result = await deleteQuickPresetAction(presetId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setError('Connection interrupted. Try again.');
      }
    });
  }

  return (
    <section className="surface shadow-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Quick access presets</h2>
          <p className="mt-1 text-sm text-label">
            Name the combinations you use most. Each one becomes a one-click button above.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close' : 'Add preset'}
        </Button>
      </div>

      {ownPresets.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {ownPresets.map((preset) => (
            <li
              key={preset.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-ink">
                {preset.label}
                <span className="ml-2 text-xs text-label">
                  {preset.scope === 'full' ? 'Full' : 'Contact'} · {preset.validity_minutes} min
                  {preset.include_documents ? ' · documents' : ''}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !online}
                onClick={() => remove(preset.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-label">
          You are using the two built-in presets. Add your own to replace them.
        </p>
      )}

      {open ? (
        <form
          action={save}
          onSubmit={(event) => {
            if (!online) event.preventDefault();
          }}
          className="mt-4 grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="preset_label">Name</Label>
            <Input id="preset_label" name="label" maxLength={40} required placeholder="e.g. Delivery agent" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preset_scope">What it shows</Label>
            <select
              id="preset_scope"
              name="scope"
              defaultValue="contact"
              className="h-9 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
            >
              <option value="contact">Contact only</option>
              <option value="full">Full profile</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preset_validity">Minutes</Label>
            <Input id="preset_validity" name="validity_minutes" type="number" min={1} max={30} defaultValue={5} required />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="include_documents" value="true" className="h-4 w-4 rounded border-hairline" />
              Include shared documents
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="h-9" disabled={pending || !online}>
              {pending ? 'Saving…' : 'Save preset'}
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

export function GiveAccess({
  defaultScope,
  defaultValidity,
  defaultIncludeDocuments,
  presets,
  sharedCount,
}: {
  defaultScope: AccessScope;
  defaultValidity: number;
  defaultIncludeDocuments: boolean;
  presets: QuickPreset[];
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
    <div className="space-y-6">
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
          <div className="sm:col-span-3">
            <p className="text-xs font-medium text-label">Quick access</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  type="submit"
                  name="preset_id"
                  value={preset.id}
                  variant="outline"
                  size="sm"
                  disabled={pending || !online}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-label">
              One click issues a code with that preset — or set the details yourself below.
            </p>
          </div>

          <div className="space-y-1.5 border-t border-subtle-line pt-4 sm:col-span-3">
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

          <div className="space-y-1.5 sm:col-span-2 sm:col-start-1">
            <Label htmlFor="validity_minutes">Code and visitor session (minutes)</Label>
            <Input
              id="validity_minutes"
              name="validity_minutes"
              type="number"
              min={1}
              max={30}
              defaultValue={defaultValidity}
              required
            />
            <p className="text-xs text-label">
              If unused, the code expires after this time. After use, the visitor session lasts the same duration.
            </p>
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
                defaultChecked={defaultIncludeDocuments}
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

      <PresetManager presets={presets} />
    </div>
  );
}
