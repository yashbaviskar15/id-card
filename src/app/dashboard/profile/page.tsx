import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { requireOwner } from '@/lib/auth/session';
import { createUserClient } from '@/lib/db/user';
import { getProfile } from '@/lib/card/load';
import { signedUrlFor } from '@/lib/storage';
import { qrPayload } from '@/lib/qr/payload';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile' };

type ProfileField = {
  id: string;
  kind: string;
  label: string | null;
  value: string | null;
  is_public: boolean;
  is_sensitive: boolean;
  sort: number;
};

function displayDate(value: string | null | undefined): string {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

async function readSafely<T>(
  source: string,
  read: () => PromiseLike<T>,
  fallback: T,
  onFailure: () => void,
): Promise<T> {
  try {
    return await read();
  } catch (cause) {
    onFailure();
    log.warn('dashboard.profile.read failed', {
      source,
      error: cause instanceof Error ? cause.name : 'unknown',
    });
    return fallback;
  }
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof UserRound;
}) {
  return (
    <div className="surface shadow-card flex min-w-0 items-center gap-3 p-4 sm:p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-label">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold tracking-tight text-ink tnum">{value}</p>
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const owner = await requireOwner('/dashboard/profile');
  let hasPartialData = false;
  const safeRead = <T,>(source: string, read: () => PromiseLike<T>, fallback: T) =>
    readSafely(source, read, fallback, () => {
      hasPartialData = true;
    });
  const [supabase, profile] = await Promise.all([
    createUserClient(),
    safeRead('profile', () => getProfile(owner.id), null),
  ]);
  const now = new Date().toISOString();

  const [
    photoUrl,
    fieldsResult,
    documentsCount,
    sharedDocumentsCount,
    activeCodesCount,
    activeSessionsCount,
    shareLinksCount,
    totpEnabled,
    recoveryCodesCount,
    factorEnabled,
    latestEvent,
  ] = await Promise.all([
    safeRead('photo', () => signedUrlFor(profile?.photo_path ?? null), null),
    safeRead(
      'fields',
      () => supabase
        .from('fields')
        .select('id, kind, label, value, is_public, is_sensitive, sort', { count: 'exact' })
        .eq('owner_id', owner.id)
        .eq('is_sensitive', false)
        .in('kind', ['email', 'phone', 'social_link', 'address'])
        .order('sort', { ascending: true })
        .limit(30)
        .returns<ProfileField[]>()
        .then(({ data, count }) => ({ data, count })),
      { data: null, count: null },
    ),
    safeRead(
      'documents',
      () => supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', owner.id).then(({ count }) => count),
      null,
    ),
    safeRead(
      'shared documents',
      () => supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', owner.id).eq('is_shared', true).then(({ count }) => count),
      null,
    ),
    safeRead(
      'access codes',
      () => supabase
        .from('access_grants')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', owner.id)
        .is('used_at', null)
        .is('revoked_at', null)
        .gt('expires_at', now)
        .then(({ count }) => count),
      null,
    ),
    safeRead(
      'active sessions',
      () => supabase
        .from('access_grants')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', owner.id)
        .is('revoked_at', null)
        .gt('session_expires_at', now)
        .then(({ count }) => count),
      null,
    ),
    safeRead(
      'share links',
      () => supabase
        .from('share_links')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', owner.id)
        .is('revoked_at', null)
        .gt('expires_at', now)
        .then(({ count }) => count),
      null,
    ),
    safeRead(
      'security settings',
      () => supabase
        .from('owner_settings')
        .select('totp_enabled')
        .eq('owner_id', owner.id)
        .maybeSingle<{ totp_enabled: boolean }>()
        .then(({ data }) => data?.totp_enabled ?? false),
      false,
    ),
    safeRead(
      'recovery codes',
      () => supabase
        .from('backup_recovery_codes')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', owner.id)
        .is('used_at', null)
        .then(({ count }) => count),
      null,
    ),
    safeRead(
      'multi-factor status',
      () => supabase.auth.mfa.listFactors().then(({ data }) =>
        (data?.all ?? []).some((factor) => factor.status === 'verified'),
      ),
      false,
    ),
    safeRead(
      'latest security event',
      () => supabase
        .from('access_log')
        .select('outcome, created_at')
        .eq('owner_id', owner.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ outcome: string; created_at: string }>()
        .then(({ data }) => data),
      null,
    ),
  ]);

  const name = profile?.full_name
    || (typeof owner.user_metadata?.full_name === 'string' ? owner.user_metadata.full_name : null)
    || (typeof owner.user_metadata?.name === 'string' ? owner.user_metadata.name : null)
    || owner.email?.split('@')[0]
    || 'Your profile';
  const mfaEnabled = totpEnabled || factorEnabled;
  const activeAccess = (activeCodesCount ?? 0) + (activeSessionsCount ?? 0);
  const fields = fieldsResult.data ?? [];
  const emailFields = fields.filter((field) => field.kind === 'email');
  const phoneFields = fields.filter((field) => field.kind === 'phone');
  const socials = fields.filter((field) => field.kind === 'social_link');
  const addresses = fields.filter((field) => field.kind === 'address');
  const publicUrl = profile ? qrPayload(profile.slug) : null;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Account</p>
          <h1 className="page-title mt-1">Your profile</h1>
          <p className="mt-1 max-w-2xl text-sm text-label">
            Your identity, dashboard activity and security status in one place.
          </p>
        </div>
        <Link
          href="/dashboard/card"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Edit profile
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      {hasPartialData ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Some dashboard information could not be loaded. Refresh this page to try again.
        </p>
      ) : null}

      <section className="surface shadow-card flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-muted text-ink">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={`${name}'s profile`}
              width={96}
              height={96}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-3xl font-semibold">{name.trim().charAt(0).toUpperCase() || 'U'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="max-w-full break-words text-2xl font-semibold tracking-tight text-ink">{name}</h2>
            <span className="inline-flex min-h-7 items-center rounded-full border border-hairline bg-muted/60 px-2.5 text-xs font-medium text-label">
              {profile?.is_active ? 'Profile active' : profile ? 'Profile paused' : 'Setup needed'}
            </span>
          </div>
          <p className="mt-1 break-all text-sm text-label">{owner.email ?? 'No sign-in email available'}</p>
          <p className="mt-3 text-xs text-label">
            Member since {displayDate(owner.created_at)} · Last signed in {displayDate(owner.last_sign_in_at)}
          </p>
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex max-w-full items-center gap-1.5 break-all text-sm font-medium text-ink underline underline-offset-4"
            >
              Visitor profile link
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <p className="mt-3 text-sm text-label">Create your identity card to activate your visitor profile.</p>
          )}
        </div>
      </section>

      <section aria-label="Dashboard summary" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Profile details" value={fieldsResult.count ?? fields.length} icon={UserRound} />
        <Metric label="Vault documents" value={documentsCount ?? 0} icon={FileText} />
        <Metric label="Shared links" value={shareLinksCount ?? 0} icon={ArrowUpRight} />
        <Metric label="Active access" value={activeAccess} icon={KeyRound} />
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 space-y-5">
          <section className="surface shadow-card min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-subtle-line px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-semibold text-ink">Personal information</h2>
                <p className="mt-1 text-sm text-label">Details saved to your identity card.</p>
              </div>
              <Link href="/dashboard/info" className="shrink-0 text-sm font-medium text-ink underline underline-offset-4">
                Manage
              </Link>
            </div>
            <dl className="divide-y divide-subtle-line">
              <InfoRow icon={Mail} label="Account email" value={owner.email ?? 'Not available'} />
              <InfoRow icon={CalendarDays} label="Date of birth" value={profile?.dob ?? 'Not provided'} />
              <InfoRow icon={MapPin} label="Address" value={profile?.address ?? 'Not provided'} />
              {emailFields.map((field) => (
                <InfoRow
                  key={field.id}
                  icon={Mail}
                  label={field.label || 'Email'}
                  value={field.value ?? 'Stored securely'}
                  badge={field.is_public ? 'Visitor visible' : 'Private'}
                />
              ))}
              {phoneFields.map((field) => (
                <InfoRow
                  key={field.id}
                  icon={Phone}
                  label={field.label || 'Phone'}
                  value={field.value ?? 'Stored securely'}
                  badge={field.is_public ? 'Visitor visible' : 'Private'}
                />
              ))}
              {addresses.map((field) => (
                <InfoRow
                  key={field.id}
                  icon={MapPin}
                  label={field.label || 'Address'}
                  value={field.value ?? 'Stored securely'}
                  badge={field.is_public ? 'Visitor visible' : 'Private'}
                />
              ))}
              {socials.map((field) => (
                <InfoRow
                  key={field.id}
                  icon={ArrowUpRight}
                  label={field.label || 'Online profile'}
                  value={field.value ?? 'Stored securely'}
                  badge={field.is_public ? 'Visitor visible' : 'Private'}
                />
              ))}
            </dl>
          </section>

          <section className="surface shadow-card min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-subtle-line px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-semibold text-ink">Dashboard workspace</h2>
                <p className="mt-1 text-sm text-label">Quick access to your identity and private files.</p>
              </div>
            </div>
            <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
              <Shortcut href="/dashboard/card" icon={UserRound} title="Card & QR" detail="Photo and profile card" />
              <Shortcut href="/dashboard/vault" icon={FileText} title="Document vault" detail={`${sharedDocumentsCount ?? 0} shared of ${documentsCount ?? 0} files`} />
              <Shortcut href="/dashboard/access" icon={KeyRound} title="Access control" detail="Codes and session history" />
              <Shortcut href="/dashboard/settings" icon={ShieldCheck} title="Account settings" detail="Preferences and sign-in" />
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="surface shadow-card min-w-0 overflow-hidden">
            <div className="border-b border-subtle-line px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-ink">Security overview</h2>
              <p className="mt-1 text-sm text-label">Sensitive controls remain in the dedicated security center.</p>
            </div>
            <dl className="divide-y divide-subtle-line">
              <SecurityRow
                label="Two-factor authentication"
                value={mfaEnabled ? 'Enabled' : 'Not enabled'}
                positive={mfaEnabled}
              />
              <SecurityRow
                label="Recovery codes remaining"
                value={String(recoveryCodesCount ?? 0)}
                positive={(recoveryCodesCount ?? 0) > 0}
              />
              <SecurityRow
                label="Shared documents"
                value={String(sharedDocumentsCount ?? 0)}
                positive
              />
              <SecurityRow
                label="Latest security event"
                value={latestEvent
                  ? `${latestEvent.outcome.replaceAll('_', ' ')} · ${displayDate(latestEvent.created_at)}`
                  : 'No access events'}
                positive={!latestEvent}
              />
            </dl>
            <div className="p-4 sm:p-5">
              <Link
                href="/dashboard/security"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-hairline px-4 text-sm font-medium text-ink transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Open security center
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
          <section className="surface shadow-card flex min-w-0 items-start gap-3 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Private by default</h2>
              <p className="mt-1 text-sm leading-6 text-label">
                Hidden details, encrypted values and recovery secrets are never exposed on this page.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-5 py-3.5 sm:px-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-label">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-label">{label}</dt>
        <dd className="mt-0.5 break-words text-sm text-ink [overflow-wrap:anywhere]">{value}</dd>
      </div>
      {badge ? <span className="hidden shrink-0 text-[11px] font-medium text-label sm:inline">{badge}</span> : null}
    </div>
  );
}

function SecurityRow({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 px-5 py-4 sm:px-6">
      <dt className="text-sm text-label">{label}</dt>
      <dd className={`max-w-[60%] break-words text-right text-sm font-medium ${positive ? 'text-ink' : 'text-[#9A3412]'}`}>
        {value}
      </dd>
    </div>
  );
}

function Shortcut({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: typeof UserRound;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-hairline p-3 transition-colors hover:border-ink/30 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-label">{detail}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-label transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
