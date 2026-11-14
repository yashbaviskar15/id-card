'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from 'cn';
import { ImagePlus, KeyRound, Search, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useOffline } from '@/components/offline/offline-provider';
import { createBrowserSupabase } from '@/lib/db/browser';
import {
  deletePrivatePhotoAction,
  finalizePrivatePhotoUploadAction,
  preparePrivatePhotoUploadAction,
  setPhotoPasswordAction,
  setPrivatePhotosEnabledAction,
} from './actions';
import { initialPhotosState, type PhotosState } from './form-state';

const ACCEPTED = '.png,.jpg,.jpeg,.webp,.heic,.heif,.tif,.tiff';
const PAGE_SIZE = 12;

export interface DashboardPhoto {
  id: string;
  name: string;
  size: number;
  created_at: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function photoExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

type SortKey = 'newest' | 'oldest' | 'name' | 'size';

function PhotoTile({ photo, onDeleted }: { photo: DashboardPhoto; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { online } = useOffline();

  async function remove() {
    if (!window.confirm(`Delete “${photo.name}” from your private album? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deletePrivatePhotoAction(photo.id);
      if (result.ok) onDeleted();
      else setError(result.error ?? 'Could not delete the photo. Try again.');
    } catch {
      setError('Could not delete the photo. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="group overflow-hidden rounded-2xl border border-page-border bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-square bg-muted/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/dashboard/photos/raw/${photo.id}`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${photo.name}`}
          disabled={busy || !online}
          onClick={remove}
          className="absolute right-1.5 top-1.5 h-8 w-8 rounded-full bg-white/85 text-label backdrop-blur hover:bg-white hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-ink" title={photo.name}>
          {photo.name}
        </p>
        <p className="text-[11px] text-label">{formatSize(photo.size)}</p>
        {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
      </div>
    </li>
  );
}

export function PhotosClient({
  photos,
  enabled,
  passwordSet,
  loadFailed,
}: {
  photos: DashboardPhoto[];
  enabled: boolean;
  passwordSet: boolean;
  loadFailed: boolean;
}) {
  const router = useRouter();
  const { online } = useOffline();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [upload, setUpload] = useState<PhotosState>(initialPhotosState);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [passwordState, submitPassword, passwordPending] = useActionState(
    setPhotoPasswordAction,
    initialPhotosState,
  );

  // Search / sort / pagination
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = photos;
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || photoExtension(p.name).includes(q),
      );
    }
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'oldest':
          return a.created_at.localeCompare(b.created_at);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'newest':
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
  }, [photos, query, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  useEffect(() => {
    setPage(1);
  }, [query, sortKey]);

  async function toggleEnabled(next: boolean) {
    setToggleError(null);
    setToggleBusy(true);
    try {
      const result = await setPrivatePhotosEnabledAction(next);
      if (result.ok) {
        setIsEnabled(next);
        router.refresh();
      } else {
        setToggleError(result.error ?? 'Could not change the setting.');
      }
    } catch {
      setToggleError('Could not change the setting. Check your connection and try again.');
    } finally {
      setToggleBusy(false);
    }
  }

  async function uploadFiles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) return;

    const files = Array.from(fileInputRef.current?.files ?? []);
    if (files.length === 0) {
      setUpload({ ok: false, error: 'Choose one or more photos to upload.' });
      return;
    }

    setUpload(initialPhotosState);
    setProgress({ done: 0, total: files.length });
    let added = 0;

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        let pendingPath: string | null = null;
        try {
          const prepared = await preparePrivatePhotoUploadAction({ name: file.name, size: file.size });
          if (!prepared.ok) {
            setUpload({ ok: false, error: `${file.name}: ${prepared.error}` });
            continue;
          }
          pendingPath = prepared.path;

          const supabase = createBrowserSupabase();
          const { error: storageError } = await supabase.storage
            .from('documents')
            .upload(pendingPath, file, { contentType: file.type || 'application/octet-stream', upsert: false });

          if (storageError) {
            await supabase.storage.from('documents').remove([pendingPath]);
            setUpload({ ok: false, error: `${file.name} could not be transferred to secure storage.` });
            continue;
          }

          const result = await finalizePrivatePhotoUploadAction({
            path: pendingPath,
            name: file.name,
            mime: file.type,
            size: file.size,
          });
          if (!result.ok) {
            await supabase.storage.from('documents').remove([pendingPath]);
            setUpload({ ok: false, error: `${file.name}: ${result.error}` });
            continue;
          }
          added += 1;
        } catch (error) {
          if (pendingPath) {
            try {
              await createBrowserSupabase().storage.from('documents').remove([pendingPath]);
            } catch {
              // A retry uses a new random path; a failed cleanup cannot expose the file.
            }
          }
          const detail = error instanceof Error ? error.message : '';
          console.error('photo upload interrupted', error);
          setUpload({
            ok: false,
            error: detail
              ? `${file.name}: ${detail}`
              : `${file.name} was interrupted. Check your connection and try again.`,
          });
        } finally {
          setProgress({ done: index + 1, total: files.length });
        }
      }

      if (added > 0) {
        setUpload({
          ok: true,
          message: added === 1 ? '1 photo added and encrypted.' : `${added} photos added and encrypted.`,
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        router.refresh();
      }
    } finally {
      setProgress(null);
    }
  }

  const uploading = progress !== null;

  return (
    <div className="w-full min-w-0 space-y-5 lg:space-y-6">
      <section className="surface shadow-card min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-prose">
            <h2 className="text-sm font-semibold text-ink">Album status</h2>
            <p className="mt-1.5 flex items-center gap-2 text-sm">
              <span className={cn('h-2 w-2 rounded-full', isEnabled ? 'bg-emerald-600' : 'bg-amber-500')} aria-hidden="true" />
              <span className="font-medium text-ink">{isEnabled ? 'Live' : 'Switched off'}</span>
              <span className="text-label">
                · {passwordSet ? 'album password set' : 'no album password yet'}
              </span>
            </p>
            {!passwordSet ? (
              <p className="mt-2 text-xs leading-5 text-label">
                Set an album password below, then switch the album on. Visitors need a one-time access code and this
                password to open it.
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant={isEnabled ? 'outline' : 'default'}
            className="h-10 shrink-0 gap-2"
            disabled={toggleBusy || !online || (!passwordSet && !isEnabled)}
            onClick={() => toggleEnabled(!isEnabled)}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {isEnabled ? 'Switch off' : 'Switch on'}
          </Button>
        </div>
        {toggleError ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{toggleError}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      <section className="surface shadow-card min-w-0 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-label" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">{passwordSet ? 'Change album password' : 'Set album password'}</h2>
        </div>
        <p className="mt-1.5 max-w-prose text-xs leading-5 text-label">
          Share this password with the people you have given a code, over a different channel. It is hashed with
          Argon2id and never stored in readable form.
        </p>
        <form action={submitPassword} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">New album password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={200}
            />
          </div>
          {passwordState.error ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{passwordState.error}</AlertDescription>
            </Alert>
          ) : null}
          {passwordState.ok && passwordState.message ? (
            <Alert className="sm:col-span-2">
              <AlertDescription>{passwordState.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" className="h-10 gap-2 font-medium" disabled={passwordPending || !online}>
              {passwordPending ? 'Saving…' : passwordSet ? 'Update password' : 'Save password'}
            </Button>
          </div>
        </form>
      </section>

      <section className="surface shadow-card min-w-0 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink">Add photos</h2>
        <p className="mt-1.5 text-xs leading-5 text-label">
          Images only (JPEG, PNG, WebP, HEIC, TIFF). Each photo is encrypted with AES-256-GCM before it is stored.
        </p>
        <form onSubmit={uploadFiles} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="files">Choose photos</Label>
            <input
              id="files"
              name="files"
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="block w-full cursor-pointer rounded-lg border border-hairline bg-white p-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
          </div>
          {upload.error ? (
            <Alert variant="destructive">
              <AlertDescription>{upload.error}</AlertDescription>
            </Alert>
          ) : null}
          {upload.ok && upload.message ? (
            <Alert>
              <AlertDescription>{upload.message}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="h-10 gap-2 font-medium" disabled={uploading || !online}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {uploading && progress ? `Uploading ${progress.done}/${progress.total}…` : 'Upload and encrypt'}
          </Button>
        </form>
      </section>

      <section className="surface shadow-card min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">
            Album {photos.length > 0 ? <span className="text-label">({photos.length})</span> : null}
          </h2>
        </div>
        {loadFailed ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>Your photos could not be loaded. Refresh the page to try again.</AlertDescription>
          </Alert>
        ) : photos.length === 0 ? (
          <p className="mt-3 text-sm text-label">No photos yet. Upload your first photo above.</p>
        ) : (
          <>
            {/* Search + sort bar */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search photos by name or extension…"
                  aria-label="Search photos"
                  className="h-10 w-full rounded-lg border border-hairline bg-white pl-9 pr-3 text-sm text-ink placeholder:text-label focus:border-ink focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-label">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  Sort
                </span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  aria-label="Sort photos"
                  className="h-10 rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="size">Largest first</option>
                </select>
              </div>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {paged.map((photo) => (
                <PhotoTile key={photo.id} photo={photo} onDeleted={() => router.refresh()} />
              ))}
            </ul>

            {filtered.length === 0 ? (
              <p className="mt-4 text-center text-sm text-label">No photos match your search.</p>
            ) : null}

            {totalPages > 1 ? (
              <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Pagination">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="px-2 text-sm text-label">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
