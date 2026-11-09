import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { searchEverything, SEARCH_LIMIT } from '@/lib/search/load';
import { maskValue } from '@/lib/crypto/fields';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, FileText, Search, ShieldCheck, UserRound } from 'lucide-react';
import type { FieldKind } from '@/lib/types';
import { SearchClient } from './search-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

const KIND_LABELS: Record<FieldKind, string> = {
  email: 'Email',
  phone: 'Phone',
  social_link: 'Social link',
  address: 'Address',
  family_contact: 'Family contact',
  emergency_contact: 'Emergency contact',
  important_date: 'Important date',
  note: 'Note',
  account_record: 'Account',
  custom: 'Custom',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const owner = await requireOwner('/dashboard/search');
  const query = (params.q ?? '').trim().slice(0, 120);

  const results = query
    ? await searchEverything(owner.id, query)
    : { documents: [], fields: [], failed: false };

  const total = results.documents.length + results.fields.length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <h1 className="page-title">Search</h1>
        <p className="mt-1 max-w-2xl text-sm text-label">
          Find a document or an information field anywhere in your vault. Sensitive values stay
          masked here — open the record to reveal one.
        </p>
      </header>

      <SearchClient queryValue={query} />

      {results.failed ? (
        <Alert variant="destructive">
          <AlertDescription>
            Some results could not be loaded. Check the Supabase schema and access policies, then
            try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {!query ? (
        <section className="surface shadow-card flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-hairline bg-muted/30">
            <Search className="h-6 w-6 text-label" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-ink">Type to search</h2>
          <p className="mt-1 max-w-xs text-sm text-label">
            Start typing a name, a label or a value to search your documents and information.
          </p>
        </section>
      ) : total === 0 && !results.failed ? (
        <section className="surface shadow-card flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-hairline bg-muted/30">
            <Search className="h-6 w-6 text-label" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-ink">No matches</h2>
          <p className="mt-1 max-w-xs text-sm text-label">
            Nothing matched “{query}”. Try a different word.
          </p>
        </section>
      ) : total > 0 ? (
        <div className="space-y-6 lg:space-y-8">
          {results.documents.length > 0 ? (
            <section className="space-y-3">
              <h2 className="eyebrow">
                Documents · {results.documents.length}
                {results.documents.length >= SEARCH_LIMIT ? '+' : ''}
              </h2>
              <ul className="surface shadow-card divide-y divide-subtle-line overflow-hidden">
                {results.documents.map((document) => (
                  <li key={document.id}>
                    <Link
                      href="/dashboard/vault"
                      className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/20 sm:px-5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-muted/40 text-label">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{document.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-label">
                          <span className="truncate max-w-[160px]">{document.category_name ?? 'Uncategorized'}</span>
                          <span className="h-1 w-1 rounded-full bg-hairline" />
                          <span className="tnum">{formatSize(document.size)}</span>
                          <span className="h-1 w-1 rounded-full bg-hairline" />
                          <span className="tnum">{formatDate(document.created_at)}</span>
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-label group-hover:text-ink">
                        Open vault
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.fields.length > 0 ? (
            <section className="space-y-3">
              <h2 className="eyebrow">
                Information · {results.fields.length}
                {results.fields.length >= SEARCH_LIMIT ? '+' : ''}
              </h2>
              <ul className="surface shadow-card divide-y divide-subtle-line overflow-hidden">
                {results.fields.map((field) => (
                  <li key={field.id}>
                    <Link
                      href="/dashboard/info"
                      className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/20 sm:px-5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-muted/40 text-label">
                        <UserRound className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink">
                            {field.label || KIND_LABELS[field.kind]}
                          </p>
                          <Badge variant="outline" className="h-5 px-2 text-[10px] font-medium">
                            {KIND_LABELS[field.kind]}
                          </Badge>
                          {field.is_sensitive ? (
                            <Badge variant="outline" className="h-5 gap-1 px-2 text-[10px] font-medium">
                              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                              Sensitive
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-label">
                          {field.is_sensitive
                            ? maskValue(field.value) || 'Hidden'
                            : field.value && field.value.trim()
                              ? field.value
                              : 'No value'}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-label group-hover:text-ink">
                        Open information
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
