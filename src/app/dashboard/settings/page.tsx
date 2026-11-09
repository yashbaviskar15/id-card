import { headers } from 'next/headers';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { createUserClient } from '@/lib/db/user';
import { truncateUserAgent } from '@/lib/crypto/ip';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const owner = await requireOwner('/dashboard/settings');
  const [supabase, headerList] = await Promise.all([createUserClient(), headers()]);

  const [settingsResult, sessionResult, reauthenticated] = await Promise.all([
    supabase.from('owner_settings').select('*').eq('owner_id', owner.id).single(),
    supabase.auth.getSession(),
    isReauthenticated(owner.id),
  ]);

  const session = sessionResult.data.session;

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-label">
          Manage your account security and preferences.
        </p>
      </header>

      <SettingsClient
        initialSettings={settingsResult.data ?? null}
        settingsLoadFailed={Boolean(settingsResult.error || !settingsResult.data)}
        email={owner.email ?? null}
        reauthenticated={reauthenticated}
        session={{
          email: owner.email ?? null,
          lastSignInAt: owner.last_sign_in_at ?? null,
          userAgent: truncateUserAgent(headerList.get('user-agent')),
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        }}
      />
    </div>
  );
}
