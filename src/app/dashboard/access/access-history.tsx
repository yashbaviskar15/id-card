'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { RevokeButton } from './give-access';
import type { AccessOutcome, AccessScope, GrantStatus } from '@/lib/types';

export interface GrantRow {
  id: string;
  scope: AccessScope;
  include_documents: boolean;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  session_expires_at: string | null;
  revoked_at: string | null;
}

export interface EventRow {
  id: string;
  outcome: AccessOutcome;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<GrantStatus, string> = {
  active: 'border-ink/20 bg-ink text-white',
  used: 'border-hairline bg-muted text-label',
  expired: 'border-hairline bg-muted text-label',
  revoked: 'border-destructive/30 bg-destructive/5 text-destructive',
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

function SearchAndSort({
  label,
  query,
  onQueryChange,
  sort,
  onSortChange,
  options,
}: {
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:w-full sm:max-w-xl sm:grid-cols-[minmax(0,1fr)_auto]">
      <label className="relative block min-w-0">
        <span className="sr-only">Search {label} on this page</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={`Search this page...`}
          className="h-11 w-full min-w-0 rounded-xl border border-hairline bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
      </label>
      <label>
        <span className="sr-only">Sort {label} on this page</span>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm font-medium text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10 sm:w-auto"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function PageNavigation({
  label,
  page,
  itemCount,
  hasNext,
  onPrevious,
  onNext,
}: {
  label: string;
  page: number;
  itemCount: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <nav
      aria-label={`${label} pages`}
      className="flex flex-col gap-3 border-t border-subtle-line bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <p className="text-xs text-label" aria-live="polite">
        Page {page} · {itemCount} {label.toLowerCase()} shown
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1}
          className="min-h-10 rounded-lg border border-hairline bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="min-h-10 rounded-lg border border-hairline bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export function AccessHistory({
  grants,
  events,
  now,
  grantPage,
  eventPage,
  grantsHasNext,
  eventsHasNext,
}: {
  grants: GrantRow[];
  events: EventRow[];
  now: number;
  grantPage: number;
  eventPage: number;
  grantsHasNext: boolean;
  eventsHasNext: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [grantQuery, setGrantQuery] = useState('');
  const [grantSort, setGrantSort] = useState('newest');
  const [eventQuery, setEventQuery] = useState('');
  const [eventSort, setEventSort] = useState('newest');
  const navigateTo = useCallback((nextGrantPage: number, nextEventPage: number) => {
    const params = new URLSearchParams();
    if (nextGrantPage > 1) params.set('grantPage', String(nextGrantPage));
    if (nextEventPage > 1) params.set('eventPage', String(nextEventPage));
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if ((grants.length === 0 && grantPage > 1) || (events.length === 0 && eventPage > 1)) {
      navigateTo(grants.length === 0 ? 1 : grantPage, events.length === 0 ? 1 : eventPage);
    }
  }, [eventPage, events.length, grantPage, grants.length, navigateTo]);

  const visibleGrants = useMemo(() => {
    const query = grantQuery.trim().toLowerCase();
    return grants
      .filter((grant) => {
        const searchable = [
          grantStatus(grant, now),
          grant.scope === 'full' ? 'full profile' : 'contact only',
          grant.include_documents ? 'documents' : '',
          when(grant.created_at),
          when(grant.expires_at),
          grant.session_expires_at ? when(grant.session_expires_at) : '',
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(query);
      })
      .sort((a, b) => {
        if (grantSort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at);
        if (grantSort === 'expires') return Date.parse(a.expires_at) - Date.parse(b.expires_at);
        if (grantSort === 'status') {
          return grantStatus(a, now).localeCompare(grantStatus(b, now));
        }
        return Date.parse(b.created_at) - Date.parse(a.created_at);
      });
  }, [grantQuery, grantSort, grants, now]);

  const visibleEvents = useMemo(() => {
    const query = eventQuery.trim().toLowerCase();
    return events
      .filter((event) => {
        const searchable = [
          OUTCOME_LABEL[event.outcome],
          event.outcome,
          event.ip_hash ? `ip ${event.ip_hash.slice(0, 8)}` : 'ip unknown',
          event.user_agent ?? '',
          when(event.created_at),
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(query);
      })
      .sort((a, b) => {
        if (eventSort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at);
        if (eventSort === 'outcome') {
          return OUTCOME_LABEL[a.outcome].localeCompare(OUTCOME_LABEL[b.outcome]);
        }
        return Date.parse(b.created_at) - Date.parse(a.created_at);
      });
  }, [eventQuery, eventSort, events]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="surface shadow-card min-w-0 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-subtle-line p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Access codes</h2>
            <p className="mt-1 text-sm text-label">
              10 codes per page. Revoking a code ends its live session.
            </p>
          </div>
          <SearchAndSort
            label="codes"
            query={grantQuery}
            onQueryChange={setGrantQuery}
            sort={grantSort}
            onSortChange={setGrantSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'expires', label: 'Expiry soonest' },
              { value: 'status', label: 'Status' },
            ]}
          />
        </div>

        {visibleGrants.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-label sm:px-6">
            {grants.length === 0 ? 'No codes handed out yet.' : 'No codes match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-subtle-line">
            {visibleGrants.map((grant) => {
              const status = grantStatus(grant, now);
              return (
                <li
                  key={grant.id}
                  className="grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[status]}`}
                    >
                      {status}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {grant.scope === 'full' ? 'Full profile' : 'Contact only'}
                      {grant.include_documents ? ' · documents' : ''}
                    </span>
                    <span className="text-sm text-label">
                      Created {when(grant.created_at)} · expires {when(grant.expires_at)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:justify-end">
                    {grant.session_expires_at ? (
                      <span className="text-xs text-label">
                        Session ends {when(grant.session_expires_at)}
                      </span>
                    ) : null}
                    {status === 'active' || status === 'used' ? (
                      <RevokeButton grantId={grant.id} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <PageNavigation
          label="Codes"
          page={grantPage}
          itemCount={visibleGrants.length}
          hasNext={grantsHasNext}
          onPrevious={() => navigateTo(grantPage - 1, eventPage)}
          onNext={() => navigateTo(grantPage + 1, eventPage)}
        />
      </section>

      <section className="surface shadow-card min-w-0 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-subtle-line p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Access log</h2>
            <p className="mt-1 text-sm text-label">
              10 events per page. IP addresses are stored as one-way digests, never as real addresses.
            </p>
          </div>
          <SearchAndSort
            label="log"
            query={eventQuery}
            onQueryChange={setEventQuery}
            sort={eventSort}
            onSortChange={setEventSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'outcome', label: 'Outcome' },
            ]}
          />
        </div>

        {visibleEvents.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-label sm:px-6">
            {events.length === 0 ? 'Nothing has happened yet.' : 'No events match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-subtle-line">
            {visibleEvents.map((event) => (
              <li
                key={event.id}
                className="grid min-w-0 gap-1.5 p-4 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(8rem,0.7fr)_minmax(0,2fr)] sm:items-center sm:gap-4 sm:px-6"
              >
                <span className="text-sm font-semibold text-ink">{OUTCOME_LABEL[event.outcome]}</span>
                <time className="text-sm text-label" dateTime={event.created_at}>
                  {when(event.created_at)}
                </time>
                <span className="min-w-0 break-words text-xs leading-5 text-label [overflow-wrap:anywhere]">
                  {event.ip_hash ? `IP ${event.ip_hash.slice(0, 8)}` : 'IP unknown'}
                  {event.user_agent ? ` · ${event.user_agent}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        <PageNavigation
          label="Events"
          page={eventPage}
          itemCount={visibleEvents.length}
          hasNext={eventsHasNext}
          onPrevious={() => navigateTo(grantPage, eventPage - 1)}
          onNext={() => navigateTo(grantPage, eventPage + 1)}
        />
      </section>
    </div>
  );
}
