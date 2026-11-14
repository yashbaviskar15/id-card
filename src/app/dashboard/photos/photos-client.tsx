'use client';

import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from 'cn';
import { ImagePlus, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
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
    <li className="group overflow-hidden rounded-2xl border border-page-border bg-white">
      <div className="relative aspect-square bg-muted/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/dashboard/photos/raw/${photo.id}`} alt="" className="h-full w-full object-cover" />
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
        } catch {
          if (pendingPath) {
            try {
              await createBrowserSupabase().storage.from('documents').remove([pendingPath]);
            } catch {
              // A retry uses a new random path; a failed cleanup cannot expose the file.
            }
          }
          setUpload({ ok: false, error: `${file.name} was interrupted. Check your connection and try again.` });
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
        <h2 className="text-sm font-semibold text-ink">
          Album {photos.length > 0 ? <span className="text-label">({photos.length})</span> : null}
        </h2>
        {loadFailed ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>Your photos could not be loaded. Refresh the page to try again.</AlertDescription>
          </Alert>
        ) : photos.length === 0 ? (
          <p className="mt-3 text-sm text-label">No photos yet. Upload your first photo above.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} onDeleted={() => router.refresh()} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
