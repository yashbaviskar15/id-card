'use client';

import { useTransition } from 'react';
import { Shield, Key, Smartphone, LogOut, Bell, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { updateSettingsAction } from './actions';

interface SettingsClientProps {
  initialSettings: {
    totp_enabled: boolean;
    alert_on_new_device: boolean;
    alert_on_lockout: boolean;
  } | null;
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [isPending, startTransition] = useTransition();

  async function handleToggle(key: 'alert_on_new_device' | 'alert_on_lockout', value: boolean) {
    startTransition(async () => {
      await updateSettingsAction({ [key]: value });
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-hairline bg-white overflow-hidden shadow-sm">
        <div className="border-b border-subtle-line px-6 py-4">
          <h2 className="text-base font-bold text-ink">Authentication</h2>
        </div>
        <div className="divide-y divide-subtle-line">
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Key className="h-4 w-4 text-label" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Password</p>
                <p className="text-xs text-label">Secure your account with a strong password</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto font-bold">Change</Button>
          </div>
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Smartphone className="h-4 w-4 text-label" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Two-factor authentication</p>
                <p className="text-xs text-label">
                  {initialSettings?.totp_enabled ? 'Currently enabled' : 'Not yet enabled'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto font-bold">
              {initialSettings?.totp_enabled ? 'Manage' : 'Enable'}
            </Button>
          </div>
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Shield className="h-4 w-4 text-label" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Passkeys</p>
                <p className="text-xs text-label">Use biometric login for faster access</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto font-bold">Add</Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-white overflow-hidden shadow-sm">
        <div className="border-b border-subtle-line px-6 py-4">
          <h2 className="text-base font-bold text-ink">Notifications</h2>
        </div>
        <div className="divide-y divide-subtle-line">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Bell className="h-4 w-4 text-label" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Login alerts</p>
                <p className="text-xs text-label">Notify me of new sign-ins</p>
              </div>
            </div>
            <Switch 
              checked={initialSettings?.alert_on_new_device} 
              onCheckedChange={(checked) => handleToggle('alert_on_new_device', checked)}
              disabled={isPending}
            />
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <AlertCircle className="h-4 w-4 text-label" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Security alerts</p>
                <p className="text-xs text-label">Notify me of account lockouts</p>
              </div>
            </div>
            <Switch 
              checked={initialSettings?.alert_on_lockout} 
              onCheckedChange={(checked) => handleToggle('alert_on_lockout', checked)}
              disabled={isPending}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-white overflow-hidden shadow-sm">
        <div className="border-b border-subtle-line px-6 py-4">
          <h2 className="text-base font-bold text-ink">Active Sessions</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Smartphone className="h-4 w-4 text-label" />
              </div>
              <div>
                <p className="font-bold text-ink">Current Device</p>
                <p className="text-xs text-label">Active now</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold border-ink/20">Active</Badge>
          </div>
          <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive font-bold border-destructive/20">
            <LogOut className="h-4 w-4 mr-2" />
            Sign out of all other devices
          </Button>
        </div>
      </section>
    </div>
  );
}
