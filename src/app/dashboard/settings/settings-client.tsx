'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, Bell, Fingerprint, Key, LogOut, Mail, Smartphone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ReauthPanel } from '@/components/auth/reauth-panel';
import { changePasswordAction } from '@/app/(auth)/actions';
import { initialFormState } from '@/app/(auth)/form-state';
import type { AccessScope } from '@/lib/types';
import { PasskeysPanel } from './passkeys-panel';
import {
  changeEmailAction,
  signOutOtherSessionsAction,
  updatePrivacyDefaultsAction,
  updateSettingsAction,
} from './actions';

interface SettingsClientProps {
  initialSettings: {
    alert_on_new_device: boolean;
    alert_on_lockout: boolean;
    default_scope: AccessScope;
    default_validity_minutes: number;
    visitor_session_minutes: number;
    totp_enabled: boolean;
  } | null;
  settingsLoadFailed: boolean;
  email: string | null;
  reauthenticated: boolean;
  session: {
    email: string | null;
    lastSignInAt: string | null;
    userAgent: string | null;
    expiresAt: string | null;
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function SettingsClient({ initialSettings, settingsLoadFailed, email, reauthenticated, session }: SettingsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [alerts, setAlerts] = useState({
    alert_on_new_device: initialSettings?.alert_on_new_device ?? true,
    alert_on_lockout: initialSettings?.alert_on_lockout ?? true,
  });
  const [privacy, setPrivacy] = useState({
    default_scope: (initialSettings?.default_scope ?? 'contact') as AccessScope,
    default_validity_minutes: initialSettings?.default_validity_minutes ?? 15,
  });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordState, submitPassword, passwordPending] = useActionState(changePasswordAction, initialFormState);
  const [emailState, submitEmail, emailPending] = useActionState(changeEmailAction, initialFormState);
  const [sessionPending, setSessionPending] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (passwordState.ok && passwordState.message) {
      setMessage(passwordState.message);
      setPasswordOpen(false);
    }
  }, [passwordState]);

  useEffect(() => {
    if (emailState.ok && emailState.message) {
      setMessage(emailState.message);
      setEmailOpen(false);
    }
  }, [emailState]);

  async function handleToggle(key: 'alert_on_new_device' | 'alert_on_lockout', value: boolean) {
    setError(null);
    setMessage(null);
    const previous = alerts[key];
    setAlerts((current) => ({ ...current, [key]: value }));
    startTransition(async () => {
      try {
        const result = await updateSettingsAction({ [key]: value });
        if (result.ok) {
          setMessage('Setting saved.');
          return;
        }
        setAlerts((current) => ({ ...current, [key]: previous }));
        setError(result.error ?? 'Could not save this setting.');
      } catch {
        setAlerts((current) => ({ ...current, [key]: previous }));
        setError('Could not save this setting. Check your connection and try again.');
      }
    });
  }

  function savePrivacy() {
    setError(null);
    setMessage(null);
    setPrivacySaving(true);
    startTransition(async () => {
      try {
        const result = await updatePrivacyDefaultsAction({
          ...privacy,
          visitor_session_minutes: privacy.default_validity_minutes,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage('Access defaults saved.');
      } catch {
        setError('Could not save your access defaults. Check your connection and try again.');
      } finally {
        setPrivacySaving(false);
      }
    });
  }

  async function signOutOtherDevices() {
    setError(null);
    setMessage(null);
    setSessionPending(true);
    try {
      const result = await signOutOtherSessionsAction();
      if (!result.ok) setError(result.error ?? 'Could not sign out other devices.');
      else setMessage('All other devices have been signed out.');
    } catch {
      setError('Could not sign out other devices. Try again.');
    } finally {
      setSessionPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {settingsLoadFailed ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Settings could not be loaded. Refresh the page before changing preferences.</AlertDescription>
        </Alert>
      ) : null}
      {error ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {message ? <Alert role="status"><AlertDescription>{message}</AlertDescription></Alert> : null}

      <section className="surface shadow-card overflow-hidden">
        <div className="border-b border-subtle-line px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">Authentication</h2>
        </div>
        <div className="divide-y divide-subtle-line">
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Key className="h-4 w-4 text-label" /></div>
              <div>
                <p className="text-sm font-medium text-ink">Password</p>
                <p className="text-xs text-label">Confirm your current password before changing it.</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full font-medium sm:w-auto" onClick={() => setPasswordOpen((open) => !open)}>
              {passwordOpen ? 'Cancel' : 'Change password'}
            </Button>
          </div>
          {passwordOpen ? (
            <form action={submitPassword} className="grid gap-4 p-6 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="current_password">Current password</Label>
                <Input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_password">New password</Label>
                <Input id="new_password" name="new_password" type="password" autoComplete="new-password" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password">Confirm new password</Label>
                <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required />
              </div>
              {passwordState.error ? <p className="text-sm text-destructive sm:col-span-3" role="alert">{passwordState.error}</p> : null}
              <Button type="submit" disabled={passwordPending} className="sm:col-span-3">
                {passwordPending ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          ) : null}

          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Mail className="h-4 w-4 text-label" /></div>
              <div>
                <p className="text-sm font-medium text-ink">Email address</p>
                <p className="break-all text-xs text-label">{email ?? 'No email address on file'}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full font-medium sm:w-auto" onClick={() => setEmailOpen((open) => !open)}>
              {emailOpen ? 'Cancel' : 'Change email'}
            </Button>
          </div>
          {emailOpen ? (
            !reauthenticated ? (
              <div className="px-6 pb-6">
                <ReauthPanel action="change your email address" />
              </div>
            ) : (
              <form action={submitEmail} className="grid gap-4 px-6 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="email">New email address</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                  <p className="text-xs leading-5 text-label">
                    Confirm the change from both the current and new inbox before it takes effect.
                  </p>
                </div>
                {emailState.error ? <p className="text-sm text-destructive sm:col-span-2" role="alert">{emailState.error}</p> : null}
                <Button type="submit" disabled={emailPending} className="sm:mb-6">
                  {emailPending ? 'Sending…' : 'Send confirmation'}
                </Button>
              </form>
            )
          ) : null}

          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Smartphone className="h-4 w-4 text-label" /></div>
              <div>
                <p className="text-sm font-medium text-ink">Two-factor authentication</p>
                <p className="text-xs text-label">
                  {initialSettings?.totp_enabled
                    ? 'Authenticator verification is protecting your account.'
                    : 'Add an authenticator app for a second sign-in step.'}
                </p>
              </div>
            </div>
            <Button render={<Link href="/dashboard/security" />} variant="outline" size="sm" className="w-full font-medium sm:w-auto">
              {initialSettings?.totp_enabled ? 'Manage two-factor' : 'Set up two-factor'}
            </Button>
          </div>

          <div className="space-y-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Fingerprint className="h-4 w-4 text-label" /></div>
              <div>
                <p className="text-sm font-medium text-ink">Passkeys</p>
                <p className="text-xs text-label">Sign in with your device instead of typing your password.</p>
              </div>
            </div>
            <PasskeysPanel />
          </div>
        </div>
      </section>

      <section className="surface shadow-card overflow-hidden">
        <div className="border-b border-subtle-line px-6 py-4"><h2 className="text-sm font-semibold text-ink">Notifications</h2></div>
        <div className="divide-y divide-subtle-line">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Bell className="h-4 w-4 text-label" /></div>
              <div><p className="text-sm font-medium text-ink">New device/browser alerts</p><p className="text-xs text-label">Email me when a sign-in uses a new browser</p></div>
            </div>
            <Switch checked={alerts.alert_on_new_device} onCheckedChange={(checked) => handleToggle('alert_on_new_device', checked)} disabled={isPending || settingsLoadFailed} aria-label="New device and browser alerts" />
          </div>
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><AlertCircle className="h-4 w-4 text-label" /></div>
              <div><p className="text-sm font-medium text-ink">Account sign-in lockout alerts</p><p className="text-xs text-label">Email me when sign-in attempts lock the account</p></div>
            </div>
            <Switch checked={alerts.alert_on_lockout} onCheckedChange={(checked) => handleToggle('alert_on_lockout', checked)} disabled={isPending || settingsLoadFailed} aria-label="Account sign-in lockout alerts" />
          </div>
          <p className="px-6 py-3 text-xs text-label">
            Email delivery also requires the server email settings to be configured.
          </p>
        </div>
      </section>

      <section className="surface shadow-card overflow-hidden">
        <div className="border-b border-subtle-line px-6 py-4"><h2 className="text-sm font-semibold text-ink">Access defaults</h2></div>
        <div className="space-y-4 px-6 py-4">
          <p className="text-sm text-label">
            These pre-fill new access codes. The duration you choose for each code also sets that visitor session to the exact same number of minutes.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="default_scope">Default share scope</Label>
              <select
                id="default_scope"
                value={privacy.default_scope}
                disabled={settingsLoadFailed}
                onChange={(event) => setPrivacy((current) => ({ ...current, default_scope: event.target.value as AccessScope }))}
                className="h-11 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink"
              >
                <option value="contact">Contact details only</option>
                <option value="full">Full profile</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default_validity_minutes">Access and session duration (minutes)</Label>
              <Input
                id="default_validity_minutes"
                type="number"
                min={1}
                max={30}
                value={privacy.default_validity_minutes}
                disabled={settingsLoadFailed}
                onChange={(event) => setPrivacy((current) => ({ ...current, default_validity_minutes: Number(event.target.value) }))}
                className="h-11"
              />
              <p className="text-xs text-label">Between 1 and 30 minutes; the visitor gets this same duration after entering the code.</p>
            </div>
          </div>
          <Button type="button" className="w-full font-medium sm:w-auto" disabled={privacySaving || settingsLoadFailed} onClick={savePrivacy}>
            {privacySaving ? 'Saving…' : 'Save access defaults'}
          </Button>
        </div>
      </section>

      <section className="surface shadow-card overflow-hidden">
        <div className="border-b border-subtle-line px-6 py-4"><h2 className="text-sm font-semibold text-ink">Session security</h2></div>
        <div className="space-y-4 px-6 py-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Smartphone className="h-4 w-4 text-label" /></div>
              <div><p className="font-medium text-ink">This session</p><p className="text-xs text-label">Your current signed-in session</p></div>
            </div>
            <Badge variant="outline" className="border-ink/20 text-[10px] font-medium">Active</Badge>
          </div>
          <dl className="grid gap-3 rounded-lg border border-hairline bg-muted/30 p-4 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-label">Signed in as</dt>
              <dd className="mt-0.5 break-all text-ink">{session.email ?? 'Unknown'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-label">Last sign-in</dt>
              <dd className="mt-0.5 text-ink">{formatDateTime(session.lastSignInAt)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-label">Browser</dt>
              <dd className="mt-0.5 break-all text-ink">{session.userAgent ?? 'Unknown'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-label">Session expires</dt>
              <dd className="mt-0.5 text-ink">{formatDateTime(session.expiresAt)}</dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-label">
            Supabase&apos;s current auth API cannot list every active session for an account, so a full
            per-device list is not available here. You can still sign out of every other device below.
          </p>
          <Button type="button" variant="outline" size="sm" className="w-full border-destructive/20 font-medium text-destructive hover:text-destructive" onClick={signOutOtherDevices} disabled={sessionPending}>
            <LogOut className="mr-2 h-4 w-4" />
            {sessionPending ? 'Please wait…' : 'Sign out of all other devices'}
          </Button>
        </div>
      </section>
    </div>
  );
}
