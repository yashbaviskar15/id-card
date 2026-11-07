import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const owner = await requireOwner('/dashboard/settings');
  const supabase = await createUserClient();

  const { data: settings, error } = await supabase
    .from('owner_settings')
    .select('*')
    .eq('owner_id', owner.id)
    .single();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-label">
          Manage your account security and preferences.
        </p>
      </header>

      <SettingsClient initialSettings={settings} settingsLoadFailed={Boolean(error || !settings)} />
    </div>
  );
}
