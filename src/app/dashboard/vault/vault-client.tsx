'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from 'cn';
import { Download, FileText, Search, Trash2 } from 'lucide-react';
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
  const router = useRouter();

  async function toggleShared(next: boolean) {
    setShared(next);
    setBusy(true);
    const result = await setDocumentSharedAction(document.id, next);
    setBusy(false);
    if (!result.ok) {
      setShared(!next);
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete “${document.name}”? This cannot be undone.`)) return;
    setBusy(true);
    const result = await deleteDocumentAction(document.id);
    setBusy(false);
    if (result.ok) router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-subtle-line bg-photo-placeholder">
          <FileText className="h-5 w-5 text-label" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink">{document.name}</p>
            {shared ? <Badge variant="outline">Shared</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-label">
            {document.category ?? 'Uncategorized'} · {formatSize(document.size)} · {formatDate(document.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <label className="flex items-center gap-2 text-xs font-medium text-ink">
          <input
            type="checkbox"
            checked={shared}
            disabled={busy}
            onChange={(event) => toggleShared(event.target.checked)}
            className="h-4 w-4 rounded border-hairline accent-ink"
          />
          Visible to visitors
        </label>
        <a
          href={`/api/documents/${document.id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download
        </a>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${document.name}`}
          disabled={busy}
          onClick={remove}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

export function VaultClient({
  documents,
  categories,
}: {
  documents: VaultDocument[];
  categories: VaultCategory[];
}) {
  const [state, submit, pending] = useActionState(uploadDocumentAction, initialVaultState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const needle = query.trim().toLowerCase();
  const filtered = documents.filter((document) => {
    const matchesQuery = needle.length === 0 || document.name.toLowerCase().includes(needle);
    const matchesCategory =
      category === '' ||
      (category === '__none' ? document.category === null : document.category === category);
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">Vault</h1>
        <p className="mt-1 text-sm text-label">
          Store your documents here. Tick “Visible to visitors” on the ones you want a code to reveal.
        </p>
      </header>

      <section className="rounded-xl border border-hairline bg-white p-4 sm:p-6">
        <h2 className="text-base font-bold text-ink">Upload a document</h2>
        <form ref={formRef} action={submit} className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="file">File</Label>
            <input
              id="file"
              name="file"
              type="file"
              accept={ACCEPTED}
              required
              className="block w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink hover:file:bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category_id">Category</Label>
            <select
              id="category_id"
              name="category_id"
              className="h-10 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:w-56"
            >
              <option value="">Uncategorized</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="h-10 sm:col-span-2 sm:w-fit" disabled={pending}>
            {pending ? 'Uploading…' : 'Upload'}
          </Button>
        </form>

        {state.error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.ok && state.message ? (
          <Alert className="mt-4 border-hairline">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-label" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
            className="h-10 pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
          className="h-10 rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:w-56"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
          <option value="__none">Uncategorized</option>
        </select>
      </div>

      <section className="rounded-xl border border-hairline bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-label" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink">
              {documents.length === 0 ? 'No documents yet' : 'No matches'}
            </h3>
            <p className="mt-1 text-sm text-label">
              {documents.length === 0
                ? 'Upload your first document to get started.'
                : 'Try a different search or category.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-subtle-line">
            {filtered.map((document) => (
              <DocumentRow key={document.id} document={document} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
