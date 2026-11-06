import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { ReauthPanel } from '@/components/auth/reauth-panel';
import { BackupClient } from './backup-client';

export const dynamic = 'force-dynamic';

export default async function BackupPage() {
  await requireOwner('/dashboard/backup');
  const reauthenticated = await isReauthenticated();

  return (
    <div className="space-y-6">
      {!reauthenticated ? <ReauthPanel action="export your data" /> : <BackupClient />}
    </div>
  );
}
