import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Shield, Key, Smartphone, LogOut, Bell, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const owner = await requireOwner('/dashboard/settings');
  const supabase = await createUserClient();

  const { data: settings } = await supabase
    .from('owner_settings')
    .select('*')
    .eq('owner_id', owner.id)
    .single();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-label">
          Manage your account security and preferences.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-xl border border-hairline bg-white overflow-hidden">
          <div className="border-b border-subtle-line px-6 py-4">
            <h2 className="text-base font-bold text-ink">Authentication</h2>
          </div>
          <div className="divide-y divide-subtle-line">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <Key className="h-4 w-4 text-label" />
                <div>
                  <p className="text-sm font-medium text-ink">Password</p>
                  <p className="text-xs text-label">Last changed 2 months ago</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Change</Button>
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-label" />
                <div>
                  <p className="text-sm font-medium text-ink">Two-factor authentication</p>
                  <p className="text-xs text-label">
                    {settings?.totp_enabled ? 'Enabled' : 'Not enabled'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                {settings?.totp_enabled ? 'Manage' : 'Enable'}
              </Button>
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-label" />
                <div>
                  <p className="text-sm font-medium text-ink">Passkeys</p>
                  <p className="text-xs text-label">Unlock with your device</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Add</Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-white overflow-hidden">
          <div className="border-b border-subtle-line px-6 py-4">
            <h2 className="text-base font-bold text-ink">Notifications</h2>
          </div>
          <div className="divide-y divide-subtle-line">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-label" />
                <div>
                  <p className="text-sm font-medium text-ink">Login alerts</p>
                  <p className="text-xs text-label">Email me when a new device signs in</p>
                </div>
              </div>
              <Switch checked={settings?.alert_on_new_device} />
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-label" />
                <div>
                  <p className="text-sm font-medium text-ink">Security alerts</p>
                  <p className="text-xs text-label">Email me on account lockouts</p>
                </div>
              </div>
              <Switch checked={settings?.alert_on_lockout} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-white overflow-hidden">
          <div className="border-b border-subtle-line px-6 py-4">
            <h2 className="text-base font-bold text-ink">Active Sessions</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-ink">Chrome on Windows</p>
                <p className="text-xs text-label">Current session · 192.168.1.1</p>
              </div>
              <Badge variant="outline" className="text-[10px] border-ink/20">Current</Badge>
            </div>
            <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out of all other devices
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
