'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createBrowserSupabase } from '@/lib/db/browser';

interface PasskeyItem {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function PasskeysPanel() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { data, error: listError } = await supabase.auth.passkey.list();
      if (listError) {
        setError('Could not load your passkeys. Refresh and try again.');
        return;
      }
      setPasskeys(data ?? []);
    } catch {
      setError('Could not load your passkeys. Refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined'
      && window.isSecureContext
      && typeof window.PublicKeyCredential !== 'undefined';
    setSupported(ok);
    if (ok) void refresh();
    else setLoading(false);
  }, [refresh]);

  async function register() {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const supabase = createBrowserSupabase();
      const { error: registerError } = await supabase.auth.registerPasskey();
      if (registerError) {
        setError('Could not add the passkey. If you cancelled the prompt, try again.');
        return;
      }
      setMessage('Passkey added. You can now use it to sign in.');
      await refresh();
    } catch {
      setError('Could not add the passkey. Try again.');
    } finally {
      setPending(false);
    }
  }

  async function remove(passkey: PasskeyItem) {
    if (!window.confirm(`Remove the passkey "${passkey.friendly_name ?? 'Passkey'}"?`)) return;
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const supabase = createBrowserSupabase();
      const { error: deleteError } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
      if (deleteError) {
        setError('Could not remove the passkey. Try again.');
        return;
      }
      setMessage('Passkey removed.');
      await refresh();
    } catch {
      setError('Could not remove the passkey. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert role="status">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {supported === false ? (
        <div className="rounded-lg border border-hairline bg-muted/40 px-4 py-3 text-sm leading-6 text-label">
          This browser does not support passkeys (WebAuthn). Passkeys need a modern browser on a secure
          (HTTPS) connection. Nothing is disabled here — you can still sign in with your password and
          two-factor code.
        </div>
      ) : (
        <>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-label" aria-live="polite">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading passkeys…
            </p>
          ) : passkeys.length > 0 ? (
            <ul className="space-y-2" aria-label="Registered passkeys">
              {passkeys.map((passkey) => (
                <li
                  key={passkey.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2 text-ink">
                    <Fingerprint className="h-4 w-4 shrink-0 text-label" aria-hidden="true" />
                    <span className="truncate font-medium">{passkey.friendly_name ?? 'Passkey'}</span>
                    <span className="shrink-0 text-xs text-label">Added {formatDate(passkey.created_at)}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {passkey.last_used_at ? (
                      <Badge variant="outline" className="hidden border-ink/15 text-[10px] sm:inline-flex">
                        Used {formatDate(passkey.last_used_at)}
                      </Badge>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      aria-label={`Remove ${passkey.friendly_name ?? 'passkey'}`}
                      disabled={pending}
                      onClick={() => remove(passkey)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-label" aria-live="polite">
              No passkeys yet. Add one to sign in without typing your password.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full font-medium sm:w-auto"
            disabled={pending || supported === null}
            onClick={register}
          >
            {pending ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {pending ? 'Waiting for your device…' : 'Add a passkey'}
          </Button>
        </>
      )}
    </div>
  );
}
