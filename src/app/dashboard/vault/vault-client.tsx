'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from 'cn';
import { ArrowUpRight, Download, FileText, Files, FolderOpen, Search, Share2, Trash2, Upload } from 'lucide-react';
import { useOffline } from '@/components/offline/offline-provider';
import { OnlineRequiredNotice } from '@/components/offline/online-notice';
import { uploadDocumentAction, setDocumentSharedAction, deleteDocumentAction } from './actions';
import { initialVaultState } from './form-state';

export interface VaultDocument {
  id: string;
  name: string;
  size: number;
  category: string | null;
  created_at: string;
  is_shared: boolean;
}

export interface VaultCategory {
  id: string;
  name: string;
}

const ACCEPTED = [
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.tif', '.tiff',
  '.doc', '.docx', '.xls', '.xlsx', '.odt', '.ods', '.txt', '.csv', '.rtf',
].join(',');

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function DocumentRow({ document }: { document: VaultDocument }) {
  const [shared, setShared] = useState(document.is_shared);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();
  const { online } = useOffline();

  async function toggleShared(next: boolean) {
    setShared(next);
    setBusy(true);
    setActionError(null);
    try {
      const result = await setDocumentSharedAction(document.id, next);
      if (!result.ok) {
        setShared(!next);
        setActionError(result.error ?? 'Could not update sharing. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setShared(!next);
      setActionError('Could not update sharing. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${document.name}”? This cannot be undone.`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await deleteDocumentAction(document.id);
      if (result.ok) {
        router.refresh();
      } else {
        setActionError(result.error ?? 'Could not delete the document. Try again.');
      }
    } catch {
      setActionError('Could not delete the document. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="group relative flex flex-col gap-4 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
          shared ? "border-ink bg-ink text-white" : "border-hairline bg-muted/40 text-label"
        )}>
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{document.name}</p>
            {shared ? (
              <Badge variant="outline" className="h-5 px-2 text-[10px] font-medium">
                Shared
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-label">
            <span className="truncate max-w-[140px]">{document.category ?? 'Uncategorized'}</span>
            <span className="h-1 w-1 rounded-full bg-hairline" />
            <span className="tnum">{formatSize(document.size)}</span>
            <span className="h-1 w-1 rounded-full bg-hairline" />
            <span className="tnum">{formatDate(document.created_at)}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <label className="flex cursor-pointer items-center gap-2.5 select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={shared}
              disabled={busy || !online}
              onChange={(event) => toggleShared(event.target.checked)}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full bg-muted ring-1 ring-hairline transition-colors peer-checked:bg-ink peer-checked:ring-ink" />
            <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all peer-checked:left-[1.125rem]" />
          </div>
          <span className="text-xs font-medium text-label">
            {shared ? 'Shared' : 'Private'}
          </span>
        </label>

        <div className="flex items-center gap-1.5">
          {online ? (
            <a
              href={`/api/documents/${document.id}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'h-9 gap-2 px-3 font-medium')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Get file
            </a>
          ) : (
            <span
              className={cn(buttonVariants({ variant: 'outline' }), 'h-9 gap-2 px-3 font-medium cursor-not-allowed opacity-50')}
              aria-disabled="true"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Get file
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Delete ${document.name}`}
            disabled={busy || !online}
            onClick={remove}
            className="text-label hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {actionError ? (
        <Alert variant="destructive" className="sm:col-span-2">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
    </li>
  );
}

export function VaultClient({
  documents,
  categories,
  page,
  pageSize,
  queryValue,
  categoryValue,
  hasNextPage,
  documentsLoadFailed,
  categoriesLoadFailed,
  filteredCount,
  totalDocuments,
  sharedDocuments,
}: {
  documents: VaultDocument[];
  categories: VaultCategory[];
  page: number;
  pageSize: number;
  queryValue: string;
  categoryValue: string;
  hasNextPage: boolean;
  documentsLoadFailed: boolean;
  categoriesLoadFailed: boolean;
  filteredCount: number;
  totalDocuments: number | null;
  sharedDocuments: number | null;
}) {
  const [state, submit, pending] = useActionState(uploadDocumentAction, initialVaultState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { online } = useOffline();
  const [query, setQuery] = useState(queryValue);
  const [category, setCategory] = useState(categoryValue);
  const [selectedFileName, setSelectedFileName] = useState('');

  const navigateTo = useCallback((nextQuery: string, nextCategory: string, nextPage: number) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    if (nextCategory) params.set('category', nextCategory);
    if (nextPage > 1) params.set('page', String(nextPage));
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setSelectedFileName('');
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    setQuery(queryValue);
    setCategory(categoryValue);
  }, [queryValue, categoryValue]);

  useEffect(() => {
    if (query.trim() === queryValue && category === categoryValue) return;
    const timer = setTimeout(() => navigateTo(query, category, 1), 300);
    return () => clearTimeout(timer);
  }, [category, categoryValue, navigateTo, query, queryValue]);

  useEffect(() => {
    if (!documentsLoadFailed && documents.length === 0 && page > 1) {
      navigateTo(queryValue, categoryValue, 1);
    }
  }, [categoryValue, documents.length, documentsLoadFailed, navigateTo, page, queryValue]);

  const hasFilters = Boolean(queryValue || categoryValue);
  const emptyVault = filteredCount === 0 && page === 1 && !hasFilters && totalDocuments === 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Private storage</p>
          <h1 className="page-title mt-1">Document vault</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-label">
            Keep important files organized, private by default, and ready to share when you choose.
          </p>
        </div>
        <Link
          href="/dashboard/share"
          className={cn(buttonVariants({ variant: 'outline' }), 'h-10 w-full gap-2 sm:w-auto')}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Create a share link
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </header>

      <section aria-label="Vault overview" className="grid gap-3 sm:grid-cols-3">
        <article className="surface shadow-card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
            <Files className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Documents</p>
            <p className="mt-0.5 text-xl font-semibold text-ink tnum">{totalDocuments ?? '—'}</p>
          </div>
        </article>
        <article className="surface shadow-card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
            <Share2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Visitor-visible</p>
            <p className="mt-0.5 text-xl font-semibold text-ink tnum">{sharedDocuments ?? '—'}</p>
          </div>
        </article>
        <article className="surface shadow-card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
            <FolderOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Categories</p>
            <p className="mt-0.5 text-xl font-semibold text-ink tnum">
              {categoriesLoadFailed ? '—' : categories.length}
            </p>
          </div>
        </article>
      </section>

      {documentsLoadFailed ? (
        <Alert variant="destructive">
          <AlertDescription>
            The vault could not load document records. Your files have not been deleted; check the Supabase schema and access policies, then refresh.
          </AlertDescription>
        </Alert>
      ) : null}
      {categoriesLoadFailed ? (
        <Alert variant="destructive">
          <AlertDescription>
            Categories could not be loaded. Documents may still appear without category names; check the Supabase schema and access policies.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="surface shadow-card p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">Add a document</h2>
            <p className="mt-1 text-sm text-label">
              Upload a file to keep it in your vault. It stays private until you enable visitor access.
            </p>
          </div>
          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
            Private by default
          </Badge>
        </div>

        <form
          ref={formRef}
          action={submit}
          onSubmit={(event) => {
            if (!online) event.preventDefault();
          }}
          className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]"
        >
          <div className="space-y-2">
            <Label htmlFor="file" className="font-medium text-ink">File</Label>
            <div className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg border border-hairline bg-white px-2.5 transition-colors focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10">
              <input
                id="file"
                name="file"
                type="file"
                accept={ACCEPTED}
                required
                aria-describedby="file-help"
                onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? '')}
                className="peer sr-only"
              />
              <Label
                htmlFor="file"
                className="inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-ink px-3 text-xs font-medium text-white transition-colors hover:bg-ink/85 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
              >
                Choose file
              </Label>
              <span className="min-w-0 truncate text-sm text-label" aria-live="polite">
                {selectedFileName || 'No file chosen'}
              </span>
            </div>
            <p id="file-help" className="text-xs text-label">Select a supported document or image to add it to your vault.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category_id" className="font-medium text-ink">Category</Label>
            <select
              id="category_id"
              name="category_id"
              className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23111827'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
            >
              <option value="">Uncategorized</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="h-11 gap-2 px-5 font-medium md:mt-7" disabled={pending || !online}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {pending ? 'Processing…' : 'Upload'}
          </Button>
        </form>

        <OnlineRequiredNotice className="mt-5">
          Document uploads need an internet connection. Files already in your vault stay available on this device.
        </OnlineRequiredNotice>

        {state.error ? (
          <Alert variant="destructive" className="mt-5">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.ok && state.message ? (
          <Alert className="mt-5">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      <section className="surface shadow-card overflow-hidden">
        <div className="space-y-4 border-b border-subtle-line p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Your documents</h2>
              <p className="mt-1 text-sm text-label">
                {documentsLoadFailed
                  ? 'The library could not be loaded.'
                  : `${filteredCount} ${filteredCount === 1 ? 'document' : 'documents'}${hasFilters ? ' match your filters' : ' in this view'}`}
              </p>
            </div>
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-label"
                onClick={() => {
                  setQuery('');
                  setCategory('');
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_14rem]">
            <div className="relative min-w-0">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-label"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search document names"
                aria-label="Search documents"
                className="h-10 border-hairline pl-9 focus:border-ink"
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="vault-category-filter">Filter by category</label>
              <select
                id="vault-category-filter"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23111827'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value="__none">Uncategorized</option>
              </select>
            </div>
          </div>
        </div>

        {documentsLoadFailed ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <FileText className="h-8 w-8 text-destructive/50" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-semibold text-ink">Documents unavailable</h3>
            <p className="mt-1 max-w-sm text-sm text-label">
              The database returned an error, so this list is not being shown as empty.
            </p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-hairline bg-muted/30">
              <FileText className="h-6 w-6 text-label" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink">
              {emptyVault ? 'Your vault is empty' : 'No documents found'}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-label">
              {emptyVault
                ? 'Upload your first document to keep it safe in your private vault.'
                : 'Try a different name or category, or clear the active filters.'}
            </p>
            {emptyVault ? (
              <Label
                htmlFor="file"
                className="mt-4 inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-ink px-3 text-sm font-medium text-white hover:bg-ink/85"
              >
                Choose a file
              </Label>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-subtle-line">
            {documents.map((document) => (
              <DocumentRow key={document.id} document={document} />
            ))}
          </ul>
        )}
        {!documentsLoadFailed && documents.length > 0 ? (
          <nav
            aria-label="Vault pages"
            className="flex flex-col gap-3 border-t border-subtle-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <p className="text-sm text-label" aria-live="polite">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCount)} of {filteredCount}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => navigateTo(queryValue, categoryValue, page - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => navigateTo(queryValue, categoryValue, page + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
