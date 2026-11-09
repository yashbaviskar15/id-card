'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Download, LoaderCircle, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReauthPanel } from '@/components/auth/reauth-panel';
import {
  disableTotpAction,
  generateRecoveryCodesAction,
  startTotpEnrollmentAction,
  verifyTotpAction,
} from './mfa-actions';
import { TotpQr } from './totp-qr';

export interface MfaFactor {
  id: string;
  friendlyName: string | null;
  status: string;
  createdAt: string;
}

interface MfaPanelProps {
  totpEnabled: boolean;
  factors: MfaFactor[];
  unusedRecoveryCodes: number;
  reauthenticated: boolean;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MfaPanel({ totpEnabled, factors, unusedRecoveryCodes, reauthenticated }: MfaPanelProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    secret: string;
    qr: { size: number; data: number[] } | null;
  } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  function startEnrollment() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await startTotpEnrollmentAction();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setEnrollment({ factorId: result.factorId, secret: result.secret, qr: result.qr });
      } catch {
        setError('Could not start two-factor setup. Check your connection and try again.');
      }
    });
  }

  function verifyEnrollment() {
    if (!enrollment) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await verifyTotpAction(enrollment.factorId, code);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setEnrollment(null);
        setCode('');
        setMessage(result.message);
        router.refresh();
      } catch {
        setError('Could not verify the code. Check your connection and try again.');
      }
    });
  }

  function disable() {
    if (!window.confirm('Turn off two-factor authentication and delete your recovery codes?')) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await disableTotpAction();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setCodes(null);
        setMessage('Two-factor authentication is off.');
        router.refresh();
      } catch {
        setError('Could not turn off two-factor authentication. Check your connection and try again.');
      }
    });
  }

  function regenerate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await generateRecoveryCodesAction();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setCodes(result.codes);
      } catch {
        setError('Could not generate recovery codes. Check your connection and try again.');
      }
    });
  }

  async function copyCodes() {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to the clipboard. Select the codes and copy them manually.');
    }
  }

  function downloadCodes() {
    if (!codes) return;
    const body = `Private Identity Vault recovery codes\nGenerated: ${new Date().toISOString()}\n\n${codes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'recovery-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const canManage = reauthenticated;

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

      <section className="surface shadow-card overflow-hidden">
        <div className="flex items-start gap-3 border-b border-subtle-line p-5 sm:p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">Two-factor authentication</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-label">
              Add a 6-digit code from an authenticator app on top of your password. Recovery codes let
              you get back in if you lose the device.
            </p>
          </div>
          <Badge
            variant="outline"
            className={totpEnabled ? 'border-emerald-500/30 text-emerald-700' : 'border-ink/20 text-label'}
          >
            {totpEnabled ? 'On' : 'Off'}
          </Badge>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {factors.length > 0 ? (
            <ul className="space-y-2" aria-label="Authenticator factors">
              {factors.map((factor) => (
                <li
                  key={factor.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-ink">
                    <ShieldCheck className="h-4 w-4 text-label" aria-hidden="true" />
                    <span className="font-medium">{factor.friendlyName ?? 'Authenticator app'}</span>
                    <span className="text-xs text-label">Added {formatDate(factor.createdAt)}</span>
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-700">
                    {factor.status === 'verified' ? 'Verified' : 'Pending'}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          {enrollment ? (
            <div className="space-y-4 rounded-lg border border-hairline p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                {enrollment.qr ? (
                  <div className="shrink-0 self-center rounded-lg border border-hairline bg-white p-2">
                    <TotpQr matrix={enrollment.qr} />
                  </div>
                ) : null}
                <div className="min-w-0 space-y-2">
                  <p className="text-sm text-ink">
                    Scan the QR code with your authenticator app, or enter this setup key manually.
                  </p>
                  <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-ink" aria-label="Setup key">
                    {enrollment.secret}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totp-code" className="font-medium text-ink">
                  Enter the 6-digit code
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="totp-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="h-11 font-mono tracking-widest sm:max-w-40"
                  />
                  <Button type="button" className="h-11" disabled={pending || code.length !== 6} onClick={verifyEnrollment}>
                    {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {pending ? 'Verifying…' : 'Verify and turn on'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={pending}
                    onClick={() => {
                      setEnrollment(null);
                      setCode('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-label" aria-live="polite">
                {totpEnabled ? 'Two-factor is protecting your account.' : 'Two-factor is not enabled yet.'}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!totpEnabled ? (
                  <Button type="button" className="w-full font-medium sm:w-auto" disabled={pending} onClick={startEnrollment}>
                    {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {pending ? 'Starting…' : 'Set up two-factor'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-destructive/30 font-medium text-destructive hover:text-destructive sm:w-auto"
                    disabled={pending || !canManage}
                    onClick={disable}
                  >
                    <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
                    Turn off two-factor
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="surface shadow-card overflow-hidden">
        <div className="flex items-start gap-3 border-b border-subtle-line p-5 sm:p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">Recovery codes</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-label">
              One-time codes you can use to get back in if you lose your authenticator. Each code works
              once. They are shown here exactly once and stored only as a hash.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <p className="text-sm text-label" aria-live="polite">
            {unusedRecoveryCodes} unused recovery code{unusedRecoveryCodes === 1 ? '' : 's'} saved.
          </p>

          {codes ? (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>
                  Save these now. They will not be shown again. Each code can be used only once.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-hairline bg-muted/40 p-3 font-mono text-sm text-ink sm:grid-cols-2">
                {codes.map((item) => (
                  <span key={item} className="select-all tracking-wider">
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="gap-2" onClick={copyCodes}>
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy all'}
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={downloadCodes}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download
                </Button>
                <Button type="button" onClick={() => setCodes(null)}>
                  I have saved them
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-label">
                {unusedRecoveryCodes > 0
                  ? 'Generating new codes replaces every existing code.'
                  : 'No recovery codes yet. Generate a set so you are not locked out.'}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full font-medium sm:w-auto"
                disabled={pending || !canManage}
                onClick={regenerate}
              >
                {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {pending ? 'Generating…' : unusedRecoveryCodes > 0 ? 'Regenerate recovery codes' : 'Generate recovery codes'}
              </Button>
            </div>
          )}

          {!canManage ? (
            <p className="text-xs leading-5 text-label">
              Turning two-factor off and regenerating recovery codes need a recent password confirmation.
            </p>
          ) : null}
        </div>
      </section>

      {!canManage ? <ReauthPanel action="manage two-factor authentication" /> : null}
    </div>
  );
}
