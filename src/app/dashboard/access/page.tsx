import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { isReauthenticated } from '@/lib/auth/reauth';
import { createUserClient } from '@/lib/db/user';
import { getProfile } from '@/lib/card/load';
import { ReauthPanel } from '@/components/auth/reauth-panel';
import { GiveAccess } from './give-access';
import { AccessHistory, type EventRow, type GrantRow } from './access-history';
import type { AccessScope } from '@/lib/types';

export const dynamic = 'force-dynamic';
const GRANTS_PAGE_SIZE = 10;
const EVENTS_PAGE_SIZE = 10;

function readPage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100_000) : 1;
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ grantPage?: string; eventPage?: string }>;
}) {
  const params = await searchParams;
  const grantPage = readPage(params.grantPage);
  const eventPage = readPage(params.eventPage);
  const owner = await requireOwner('/dashboard/access');
  const [reauthenticated, supabase] = await Promise.all([
    isReauthenticated(owner.id),
    createUserClient(),
  ]);
  const [profile, grantsResult, eventsResult, settingsResult, sharedCountResult] = await Promise.all([
    getProfile(owner.id),
    supabase
      .from('access_grants')
      .select('id, scope, include_documents, created_at, expires_at, used_at, session_expires_at, revoked_at')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((grantPage - 1) * GRANTS_PAGE_SIZE, grantPage * GRANTS_PAGE_SIZE)
      .returns<GrantRow[]>(),
    supabase
      .from('access_log')
      .select('id, outcome, ip_hash, user_agent, created_at')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((eventPage - 1) * EVENTS_PAGE_SIZE, eventPage * EVENTS_PAGE_SIZE)
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

  const grantRows = grantsResult.data ?? [];
  const eventRows = eventsResult.data ?? [];
  const grantsHasNext = grantRows.length > GRANTS_PAGE_SIZE;
  const eventsHasNext = eventRows.length > EVENTS_PAGE_SIZE;
  const grants = grantRows.slice(0, GRANTS_PAGE_SIZE);
  const events = eventRows.slice(0, EVENTS_PAGE_SIZE);
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

      <AccessHistory
        grants={grants}
        events={events}
        now={now}
        grantPage={grantPage}
        eventPage={eventPage}
        grantsHasNext={grantsHasNext}
        eventsHasNext={eventsHasNext}
      />
    </div>
  );
}
