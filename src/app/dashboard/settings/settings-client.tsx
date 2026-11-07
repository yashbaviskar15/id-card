'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { AlertCircle, Bell, Key, LogOut, Shield, Smartphone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { changePasswordAction } from '@/app/(auth)/actions';
import { initialFormState } from '@/app/(auth)/form-state';
import { signOutOtherSessionsAction, updateSettingsAction } from './actions';

interface SettingsClientProps {
  initialSettings: {
    alert_on_new_device: boolean;
    alert_on_lockout: boolean;
  } | null;
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [alerts, setAlerts] = useState({
    alert_on_new_device: initialSettings?.alert_on_new_device ?? true,
    alert_on_lockout: initialSettings?.alert_on_lockout ?? true,
  });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordState, submitPassword, passwordPending] = useActionState(changePasswordAction, initialFormState);
  const [sessionPending, setSessionPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (passwordState.ok && passwordState.message) {
      setMessage(passwordState.message);
      setPasswordOpen(false);
    }
  }, [passwordState]);

  async function handleToggle(key: 'alert_on_new_device' | 'alert_on_lockout', value: boolean) {
    setError(null);
    setMessage(null);
    const previous = alerts[key];
    setAlerts((current) => ({ ...current, [key]: value }));
    startTransition(async () => {
      const result = await updateSettingsAction({ [key]: value });
      if (!result.ok) {
        setAlerts((current) => ({ ...current, [key]: previous }));
        setError(result.error ?? 'Could not save this setting.');
      } else {
        setMessage('Setting saved.');
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
      {error ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {message ? <Alert role="status"><AlertDescription>{message}</AlertDescription></Alert> : null}

      <section className="overflow-hidden rounded-xl border border-hairline bg-white shadow-sm">
        <div className="border-b border-subtle-line px-6 py-4">
          <h2 className="text-base font-bold text-ink">Authentication</h2>
        </div>
        <div className="divide-y divide-subtle-line">
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Key className="h-4 w-4 text-label" /></div>
              <div>
                <p className="text-sm font-bold text-ink">Password</p>
                <p className="text-xs text-label">Confirm your current password before changing it.</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full font-bold sm:w-auto" onClick={() => setPasswordOpen((open) => !open)}>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Smartphone className="h-4 w-4 text-label" /></div>
              <div>
                <p className="text-sm font-bold text-ink">Two-factor authentication</p>
                <p className="text-xs text-label">Unavailable until sign-in can enforce authenticator verification.</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full font-bold sm:w-auto" disabled>
              Not available
            </Button>
          </div>
          <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Shield className="h-4 w-4 text-label" /></div>
            <div>
              <p className="text-sm font-bold text-ink">Passkeys</p>
              <p className="text-xs text-label">Unavailable until passkey registration is configured for this app.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-hairline bg-white shadow-sm">
        <div className="border-b border-subtle-line px-6 py-4"><h2 className="text-base font-bold text-ink">Notifications</h2></div>
        <div className="divide-y divide-subtle-line">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Bell className="h-4 w-4 text-label" /></div>
              <div><p className="text-sm font-bold text-ink">Login alerts</p><p className="text-xs text-label">Notify me of new sign-ins</p></div>
            </div>
            <Switch checked={alerts.alert_on_new_device} onCheckedChange={(checked) => handleToggle('alert_on_new_device', checked)} disabled={isPending} aria-label="Login alerts" />
          </div>
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><AlertCircle className="h-4 w-4 text-label" /></div>
              <div><p className="text-sm font-bold text-ink">Security alerts</p><p className="text-xs text-label">Notify me of account lockouts</p></div>
            </div>
            <Switch checked={alerts.alert_on_lockout} onCheckedChange={(checked) => handleToggle('alert_on_lockout', checked)} disabled={isPending} aria-label="Security alerts" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-hairline bg-white shadow-sm">
        <div className="border-b border-subtle-line px-6 py-4"><h2 className="text-base font-bold text-ink">Active Sessions</h2></div>
        <div className="space-y-4 px-6 py-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Smartphone className="h-4 w-4 text-label" /></div>
              <div><p className="font-bold text-ink">Current Device</p><p className="text-xs text-label">Active now</p></div>
            </div>
            <Badge variant="outline" className="border-ink/20 text-[10px] font-bold">Active</Badge>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full border-destructive/20 font-bold text-destructive hover:text-destructive" onClick={signOutOtherDevices} disabled={sessionPending}>
            <LogOut className="mr-2 h-4 w-4" />
            {sessionPending ? 'Please wait…' : 'Sign out of all other devices'}
          </Button>
        </div>
      </section>
    </div>
  );
}
