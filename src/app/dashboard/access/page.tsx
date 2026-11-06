import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { createUserClient } from '@/lib/db/user';
import { getProfile } from '@/lib/card/load';
import { ReauthPanel } from '@/components/auth/reauth-panel';
import { GiveAccess, RevokeButton } from './give-access';
import type { AccessScope, AccessOutcome, GrantStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface GrantRow {
  id: string;
  scope: AccessScope;
  include_documents: boolean;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  session_expires_at: string | null;
  revoked_at: string | null;
}

interface EventRow {
  id: string;
  outcome: AccessOutcome;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<GrantStatus, string> = {
  active: 'border-ink text-ink',
  used: 'border-subtle-line text-label',
  expired: 'border-subtle-line text-label',
  revoked: 'border-destructive/40 text-destructive',
};

const OUTCOME_LABEL: Record<AccessOutcome, string> = {
  granted: 'Code accepted',
  invalid: 'Wrong code',
  expired: 'Code expired',
  used: 'Code already used',
  revoked: 'Code revoked',
  rate_limited: 'Rate limited',
  locked: 'Locked out',
  session_view: 'Profile viewed',
  session_end: 'Session ended',
};

function grantStatus(grant: GrantRow, now: number): GrantStatus {
  if (grant.revoked_at) return 'revoked';
  if (grant.used_at) return 'used';
  if (Date.parse(grant.expires_at) <= now) return 'expired';
  return 'active';
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AccessPage() {
  const owner = await requireOwner('/dashboard/access');
  const reauthenticated = await isReauthenticated();
  const supabase = await createUserClient();

  const profile = await getProfile(owner.id);
  const [grantsResult, eventsResult, settingsResult, sharedCountResult] = await Promise.all([
    supabase
      .from('access_grants')
      .select('id, scope, include_documents, created_at, expires_at, used_at, session_expires_at, revoked_at')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .limit(25)
      .returns<GrantRow[]>(),
    supabase
      .from('access_log')
      .select('id, outcome, ip_hash, user_agent, created_at')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .limit(40)
      .returns<EventRow[]>(),
    supabase
      .from('owner_settings')
      .select('default_scope, default_validity_minutes')
      .eq('owner_id', owner.id)
      .maybeSingle<{ default_scope: AccessScope; default_validity_minutes: number }>(),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id)
      .eq('is_shared', true),
  ]);

  const grants = grantsResult.data ?? [];
  const events = eventsResult.data ?? [];
  const sharedCount = sharedCountResult.count ?? 0;
  const now = Date.now();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">Access</h1>
        <p className="mt-1 text-sm text-label">
          Every visit starts from the one permanent QR code. You decide who gets in, for how long, and
          what they can see.
        </p>
      </header>

      {!profile ? (
        <section className="rounded-xl border border-hairline bg-white p-6">
          <p className="text-sm text-label">
            Save your card first. The profile link is created once and never changes.
          </p>
          <Link
            href="/dashboard/card"
            className="mt-3 inline-block text-sm font-semibold text-ink underline underline-offset-4"
          >
            Go to Card &amp; QR
          </Link>
        </section>
      ) : reauthenticated ? (
        <GiveAccess
          defaultScope={settingsResult.data?.default_scope ?? 'contact'}
          defaultValidity={settingsResult.data?.default_validity_minutes ?? 5}
          sharedCount={sharedCount}
        />
      ) : (
        <ReauthPanel action="hand out a code" />
      )}

      <section className="rounded-xl border border-hairline bg-white">
        <div className="border-b border-subtle-line px-6 py-4">
          <h2 className="text-base font-bold text-ink">Codes</h2>
          <p className="mt-1 text-sm text-label">The 25 most recent. Revoking one ends a live session at once.</p>
        </div>

        {grants.length === 0 ? (
          <p className="px-6 py-6 text-sm text-label">No codes handed out yet.</p>
        ) : (
          <ul className="divide-y divide-subtle-line">
            {grants.map((grant) => {
              const status = grantStatus(grant, now);
              return (
                <li key={grant.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
                    {status}
                  </span>
                  <span className="text-sm text-ink">
                    {grant.scope === 'full' ? 'Full profile' : 'Contact only'}
                    {grant.include_documents ? ' · documents' : ''}
                  </span>
                  <span className="text-sm text-label">
                    created {when(grant.created_at)} · expires {when(grant.expires_at)}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    {grant.session_expires_at ? (
                      <span className="text-xs text-label">session ends {when(grant.session_expires_at)}</span>
                    ) : null}
                    {status === 'active' || status === 'used' ? (
                      <RevokeButton grantId={grant.id} />
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-hairline bg-white">
        <div className="border-b border-subtle-line px-6 py-4">
          <h2 className="text-base font-bold text-ink">Access log</h2>
          <p className="mt-1 text-sm text-label">
            Addresses are stored as short one-way digests, never as real addresses.
          </p>
        </div>

        {events.length === 0 ? (
          <p className="px-6 py-6 text-sm text-label">Nothing has happened yet.</p>
        ) : (
          <ul className="divide-y divide-subtle-line">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3">
                <span className="text-sm font-semibold text-ink">{OUTCOME_LABEL[event.outcome]}</span>
                <span className="text-sm text-label">{when(event.created_at)}</span>
                <span className="text-xs text-label">
                  {event.ip_hash ? `ip ${event.ip_hash.slice(0, 8)}` : 'ip unknown'}
                  {event.user_agent ? ` · ${event.user_agent.slice(0, 48)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
