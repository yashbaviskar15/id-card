import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { createUserClient } from '@/lib/db/user';
import { SecurityClient } from './security-client';
import { MfaPanel, type MfaFactor } from './mfa-panel';
import { ArrowUpRight, Check, CircleAlert, FileLock2, KeyRound, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Security' };

type ProfileStatus = { is_active: boolean };
type GrantStatus = {
  used_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  session_expires_at: string | null;
};
type DocumentStatus = { is_shared: boolean };
type AccessEvent = { outcome: string; created_at: string };
type SecuritySettings = { totp_enabled: boolean };

function StatusCard({
  title,
  value,
  description,
  icon: Icon,
  good,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof ShieldCheck;
  good: boolean;
}) {
  return (
    <section className="surface shadow-card min-w-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-label">{title}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{value}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-label">
        <span className="inline-flex items-center gap-1">
          {good ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
          {description}
        </span>
      </p>
    </section>
  );
}

export default async function SecurityPage() {
  const owner = await requireOwner('/dashboard/security');
  const [reauthenticated, supabase] = await Promise.all([
    isReauthenticated(owner.id),
    createUserClient(),
  ]);
  const now = Date.now();
  const [profileResult, grantsResult, documentsResult, eventsResult, settingsResult, recoveryResult, factorsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_active')
      .eq('owner_id', owner.id)
      .maybeSingle<ProfileStatus>(),
    supabase
      .from('access_grants')
      .select('used_at, revoked_at, expires_at, session_expires_at')
      .eq('owner_id', owner.id)
      .is('revoked_at', null)
      .returns<GrantStatus[]>(),
    supabase
      .from('documents')
      .select('is_shared')
      .eq('owner_id', owner.id)
      .returns<DocumentStatus[]>(),
    supabase
      .from('access_log')
      .select('outcome, created_at')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<AccessEvent>(),
    supabase
      .from('owner_settings')
      .select('totp_enabled')
      .eq('owner_id', owner.id)
      .maybeSingle<SecuritySettings>(),
    supabase
      .from('backup_recovery_codes')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id)
      .is('used_at', null),
    supabase.auth.mfa.listFactors(),
  ]);

  const activeAccessCount = (grantsResult.data ?? []).filter((grant) => {
    if (grant.revoked_at) return false;
    const expiry = grant.used_at && grant.session_expires_at
      ? Date.parse(grant.session_expires_at)
      : Date.parse(grant.expires_at);
    return expiry > now;
  }).length;
  const sharedDocumentCount = (documentsResult.data ?? []).filter((document) => document.is_shared).length;
  const dataLoadFailed = Boolean(profileResult.error || grantsResult.error || documentsResult.error || eventsResult.error);
  const mfaFactors: MfaFactor[] = (factorsResult.data?.all ?? []).map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    status: factor.status,
    createdAt: factor.created_at,
  }));
  const totpEnabled = Boolean(settingsResult.data?.totp_enabled) || mfaFactors.some((factor) => factor.status === 'verified');

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Security</h1>
          <p className="mt-1 text-sm text-label">
            Review what is exposed and stop visitor access from one place.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-hairline bg-white px-3 text-sm font-medium text-ink hover:border-ink sm:self-auto"
        >
          Account settings <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      {dataLoadFailed ? (
        <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Some security status could not be loaded. Refresh before making decisions based on these counts.
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Visitor profile"
          value={profileResult.data ? (profileResult.data.is_active ? 'Enabled' : 'Disabled') : 'Not created'}
          description={profileResult.data?.is_active ? 'Permanent link accepts access codes' : 'Visitor profile is not publicly active'}
          icon={ShieldCheck}
          good={!profileResult.data?.is_active}
        />
        <StatusCard
          title="Valid access"
          value={String(activeAccessCount)}
          description="Unused codes or sessions not yet expired"
          icon={KeyRound}
          good={activeAccessCount === 0}
        />
        <StatusCard
          title="Shared files"
          value={String(sharedDocumentCount)}
          description="Files marked eligible for visitor access"
          icon={FileLock2}
          good={sharedDocumentCount === 0}
        />
        <StatusCard
          title="Latest access event"
          value={eventsResult.data ? new Date(eventsResult.data.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }) : 'No events'}
          description={eventsResult.data?.outcome.replaceAll('_', ' ') ?? 'The access log is empty'}
          icon={CircleAlert}
          good={Boolean(eventsResult.data)}
        />
      </div>

      <MfaPanel
        totpEnabled={totpEnabled}
        factors={mfaFactors}
        unusedRecoveryCodes={recoveryResult.count ?? 0}
        reauthenticated={reauthenticated}
      />

      <SecurityClient activeAccessCount={activeAccessCount} />
    </div>
  );
}
