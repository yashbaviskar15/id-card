'use client';

import { useCallback, useEffect, useState } from 'react';
import { BrandMark } from '@/components/brand/brand-mark';
import { SessionTimer } from '@/components/access/session-timer';
import { Images, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { cn } from 'cn';
import type { GrantedPhoto, GrantedPhotoAlbum } from '@/lib/types';

function photoSrc(slug: string, photoId: string): string {
  return `/p/${encodeURIComponent(slug)}/photos/raw/${encodeURIComponent(photoId)}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * View-only album. There is deliberately no download affordance: images render
 * inside the page (inline), the drag/save context menu is suppressed, and no
 * object URL or storage path is ever exposed to the client. This is a
 * deterrent layer on top of the real control — the bytes are only ever served
 * through the gated stream route and are encrypted at rest.
 */
export function PhotoAlbumView({ slug, album }: { slug: string; album: GrantedPhotoAlbum }) {
  const [active, setActive] = useState<GrantedPhoto | null>(null);

  const close = useCallback(() => setActive(null), []);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  return (
    <div className="visitor-page min-h-dvh bg-[#F6F7F8] font-inter text-[#172033] select-none">
      <header className="border-b border-[#E6E9ED] bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="rounded-[10px]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-[#172033]">Private photos</p>
              <p className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-[#8792A0] sm:block">
                Encrypted album
              </p>
            </div>
          </div>
          <SessionTimer until={album.session_expires_at} serverNow={album.server_now} />
        </div>
      </header>

      <main className="animate-enter mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-7 sm:pt-9">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E4E8EC] bg-white px-3 py-1.5 text-xs font-medium text-[#465365]">
            <ShieldCheck size={15} strokeWidth={1.8} aria-hidden="true" />
            View only · no download
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E4E8EC] bg-white px-3 py-1.5 text-xs font-medium text-[#465365]">
            <Images size={15} strokeWidth={1.8} aria-hidden="true" />
            {album.photos.length} {album.photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {album.photos.length === 0 ? (
          <div className="surface flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-ink">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-ink">No photos yet</p>
            <p className="max-w-sm text-sm text-label">
              The owner has not added any private photos. Check back later.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {album.photos.map((photo) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setActive(photo)}
                  onContextMenu={(event) => event.preventDefault()}
                  aria-label={`View ${photo.name}`}
                  className="group block w-full overflow-hidden rounded-2xl border border-[#E2E6EB] bg-white p-1.5 text-left transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <span className="relative block aspect-square overflow-hidden rounded-xl bg-[#EEF1F4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoSrc(slug, photo.id)}
                      alt=""
                      draggable={false}
                      referrerPolicy="no-referrer"
                      onContextMenu={(event) => event.preventDefault()}
                      className="pointer-events-none h-full w-full object-cover"
                    />
                  </span>
                  <span className="mt-1.5 block truncate px-1 text-xs text-[#697586]">
                    {photo.name} · {formatSize(photo.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-8 border-t border-[#E2E6EB] pt-5 text-center text-xs leading-5 text-[#8792A0]">
          Photos are encrypted and shown for the active session only. Downloading is disabled.
        </footer>
      </main>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.name}
          onClick={close}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm',
          )}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoSrc(slug, active.id)}
            alt={active.name}
            draggable={false}
            referrerPolicy="no-referrer"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
            className="max-h-[88vh] max-w-full select-none rounded-lg object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
