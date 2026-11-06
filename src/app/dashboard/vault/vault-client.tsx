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
    <li className={cn(
      "group relative flex flex-col gap-6 p-6 transition-all sm:flex-row sm:items-center sm:gap-8",
      shared ? "bg-white" : "bg-[#f8f9fa]/50 hover:bg-white"
    )}>
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <div className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border-2 transition-all shadow-sm",
          shared ? "border-ink bg-ink text-white rotate-3" : "border-hairline bg-white text-label group-hover:border-subtle-line"
        )}>
          <FileText className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-black text-ink tracking-tight">{document.name}</p>
            {shared ? (
              <Badge className="bg-ink text-white border-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] rounded-full">
                Public
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] font-black text-label/60 uppercase tracking-widest flex items-center gap-2">
            <span className="truncate max-w-[120px]">{document.category ?? 'Uncategorized'}</span>
            <span className="h-1 w-1 rounded-full bg-hairline" />
            <span>{formatSize(document.size)}</span>
            <span className="h-1 w-1 rounded-full bg-hairline" />
            <span>{formatDate(document.created_at)}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-5 sm:justify-end">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={shared}
              disabled={busy}
              onChange={(event) => toggleShared(event.target.checked)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-muted border-2 border-hairline transition-all peer-checked:bg-ink peer-checked:border-ink" />
            <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-all peer-checked:left-6" />
          </div>
          <span className="text-[10px] font-black text-ink uppercase tracking-widest">
            {shared ? 'Shared' : 'Private'}
          </span>
        </label>
        
        <div className="h-10 w-px bg-hairline hidden sm:block" />

        <div className="flex items-center gap-2">
          <a
            href={`/api/documents/${document.id}`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'default' }), 
              "h-11 rounded-xl border-2 border-ink px-5 font-black text-xs uppercase tracking-widest transition-all hover:bg-ink hover:text-white active:scale-95"
            )}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Get File
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Delete ${document.name}`}
            disabled={busy}
            onClick={remove}
            className="h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all active:scale-90"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
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
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black tracking-tighter text-ink">Document Vault</h1>
        <p className="mt-2 text-base font-medium text-label max-w-2xl">
          Secure storage for your private files. Shared documents can be accessed by visitors who enter a valid profile code.
        </p>
      </header>

      <section className="rounded-3xl border border-hairline bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-2 w-2 rounded-full bg-ink animate-pulse" />
          <h2 className="text-[10px] font-black tracking-[0.3em] text-label uppercase">Upload New Asset</h2>
        </div>
        
        <form ref={formRef} action={submit} className="grid gap-6 md:grid-cols-[1fr_240px_auto] items-end">
          <div className="space-y-3">
            <Label htmlFor="file" className="text-xs font-black uppercase tracking-widest text-ink ml-1">Select File</Label>
            <div className="relative group">
              <input
                id="file"
                name="file"
                type="file"
                accept={ACCEPTED}
                required
                className="block w-full rounded-2xl border-2 border-hairline bg-white px-4 py-3 text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:text-white hover:border-ink transition-all cursor-pointer"
              />
            </div>
          </div>
          <div className="space-y-3">
            <Label htmlFor="category_id" className="text-xs font-black uppercase tracking-widest text-ink ml-1">Category</Label>
            <select
              id="category_id"
              name="category_id"
              className="h-[52px] w-full rounded-2xl border-2 border-hairline bg-white px-4 text-sm font-bold text-ink focus:border-ink focus:outline-none transition-all cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23111827'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2rem' }}
            >
              <option value="">Uncategorized</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="h-[52px] px-10 rounded-2xl bg-ink text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-ink/20 transition-all active:scale-95 disabled:opacity-50" disabled={pending}>
            {pending ? 'Processing…' : 'Upload File'}
          </Button>
        </form>

        {state.error ? (
          <Alert variant="destructive" className="mt-8 rounded-2xl border-2">
            <AlertDescription className="font-bold">{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.ok && state.message ? (
          <Alert className="mt-8 rounded-2xl border-2 border-ink bg-ink text-white">
            <AlertDescription className="font-bold">{state.message}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-label/40" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your vault…"
            aria-label="Search documents"
            className="h-14 pl-12 rounded-2xl border-2 border-hairline bg-white font-bold focus:border-ink transition-all"
          />
        </div>
        <div className="relative w-full sm:w-64">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
            className="h-14 w-full rounded-2xl border-2 border-hairline bg-white px-4 text-sm font-bold text-ink focus:border-ink focus:outline-none transition-all cursor-pointer appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23111827'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2rem' }}
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
      </div>

      <section className="rounded-[32px] border border-hairline bg-white overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.02)]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f8f9fa] border-2 border-dashed border-hairline">
              <FileText className="h-10 w-10 text-label/20" aria-hidden="true" />
            </div>
            <h3 className="mt-6 text-lg font-black text-ink tracking-tight">
              {documents.length === 0 ? 'Your vault is empty' : 'No matches found'}
            </h3>
            <p className="mt-2 text-sm font-medium text-label max-w-xs">
              {documents.length === 0
                ? 'Upload your first document to keep it safe in your private vault.'
                : 'We couldn\'t find any documents matching your current filters.'}
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
