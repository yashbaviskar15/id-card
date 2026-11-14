'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandMark } from '@/components/brand/brand-mark';
import { SessionTimer } from '@/components/access/session-timer';
import { Images, LockKeyhole, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
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

function photoExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

type SortKey = 'newest' | 'oldest' | 'name' | 'size';

const PAGE_SIZE = 12;

/**
 * View-only album. There is deliberately no download affordance: images render
 * inside the page (inline), the drag/save context menu is suppressed, and no
 * object URL or storage path is ever exposed to the client. This is a
 * deterrent layer on top of the real control — the bytes are only ever served
 * through the gated stream route and are encrypted at rest.
 */
export function PhotoAlbumView({ slug, album: initialAlbum }: { slug: string; album: GrantedPhotoAlbum }) {
  const [album, setAlbum] = useState<GrantedPhotoAlbum>(initialAlbum);
  const [active, setActive] = useState<GrantedPhoto | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Search / filter / pagination state
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const close = useCallback(() => setActive(null), []);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  // Live sync: SSE stream with polling fallback, mirroring the profile page.
  useEffect(() => {
    if (sessionEnded) return;
    let disposed = false;
    let source: EventSource | null = null;
    let fallbackTimer: number | null = null;
    let failures = 0;
    let inFlight = false;
    let controller: AbortController | null = null;

    const endSession = () => {
      if (disposed) return;
      setSessionEnded(true);
    };

    const applyAlbum = (next: GrantedPhotoAlbum) => {
      setAlbum(next);
      setReconnecting(false);
    };

    async function refreshSnapshot() {
      if (document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const response = await fetch(`/p/${encodeURIComponent(slug)}/photos/snapshot`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (response.status === 401) {
          endSession();
          return;
        }
        if (!response.ok) {
          setReconnecting(true);
          return;
        }
        const json = (await response.json()) as { album: GrantedPhotoAlbum };
        if (json.album) applyAlbum(json.album);
      } catch {
        if (!controller.signal.aborted) setReconnecting(true);
      } finally {
        inFlight = false;
      }
    }

    const startFallbackPolling = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(() => void refreshSnapshot(), 1_000);
    };

    const stopFallbackPolling = () => {
      if (fallbackTimer === null) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    };

    const openStream = () => {
      if (disposed || source) return;
      source = new EventSource(`/p/${encodeURIComponent(slug)}/photos/stream`);

      source.addEventListener('open', () => {
        failures = 0;
        setReconnecting(false);
        stopFallbackPolling();
      });
      source.addEventListener('message', (event) => {
        try {
          const json = JSON.parse((event as MessageEvent<string>).data) as { album: GrantedPhotoAlbum };
          if (json.album) applyAlbum(json.album);
        } catch {
          /* ignore a malformed frame; the next one corrects it */
        }
      });
      source.addEventListener('ended', () => {
        source?.close();
        source = null;
        endSession();
      });
      source.addEventListener('recycle', () => {
        source?.close();
        source = null;
        openStream();
      });
      source.addEventListener('error', () => {
        failures += 1;
        if (failures >= 4) {
          source?.close();
          source = null;
          setReconnecting(true);
          startFallbackPolling();
          void refreshSnapshot();
        }
      });
    };

    openStream();

    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshSnapshot();
      if (fallbackTimer !== null) openStream();
    };
    const reconnectWhenOnline = () => {
      if (document.visibilityState === 'visible' && fallbackTimer !== null) openStream();
      void refreshSnapshot();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', reconnectWhenOnline);

    return () => {
      disposed = true;
      source?.close();
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', reconnectWhenOnline);
      controller?.abort();
    };
  }, [sessionEnded, slug]);

  // Derived: filtered + sorted + paginated photos.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = album.photos;
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || photoExtension(p.name).includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
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
    return sorted;
  }, [album.photos, query, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  useEffect(() => {
    setPage(1);
  }, [query, sortKey]);

  if (sessionEnded) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F6F7F8] px-4 py-10 font-inter">
        <section className="w-full max-w-md rounded-2xl border border-[#E2E6EB] bg-white p-7 text-center shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-9">
          <BrandMark className="mx-auto rounded-xl" />
          <span className="mx-auto mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-[#F1F3F5] text-[#334155]">
            <LockKeyhole size={19} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-[#172033]">This album session has ended</h1>
          <p className="mt-2 text-sm leading-6 text-[#697586]">
            The owner may have revoked access, switched the album off, or the session expired. Request a new code to continue.
          </p>
          <a href={`/p/${slug}`} className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#172033] px-5 text-sm font-medium text-white hover:bg-[#28354B]">
            Return to access screen
          </a>
        </section>
      </main>
    );
  }

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
        {reconnecting ? (
          <p role="status" className="mb-4 rounded-lg border border-[#E3E7EB] bg-white px-4 py-3 text-sm text-[#697586]">
            Connection interrupted. Retrying securely…
          </p>
        ) : null}

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
          <>
            {/* Search + sort bar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8792A0]" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search photos by name…"
                  aria-label="Search photos"
                  className="h-10 w-full rounded-lg border border-[#D7DDE4] bg-white pl-9 pr-3 text-sm text-[#172033] placeholder:text-[#9AA6B2] focus:border-[#172033] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((s) => !s)}
                  aria-expanded={showFilters}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D7DDE4] bg-white px-3 text-sm font-medium text-[#334155] hover:bg-[#F5F7F8]"
                >
                  <SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
                  Sort
                </button>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  aria-label="Sort photos"
                  className="h-10 rounded-lg border border-[#D7DDE4] bg-white px-3 text-sm text-[#172033] focus:border-[#172033] focus:outline-none"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="size">Largest first</option>
                </select>
              </div>
            </div>

            {showFilters ? (
              <div className="mb-4 rounded-lg border border-[#E2E6EB] bg-white p-4 text-xs text-[#697586]">
                Sort the album by upload date, name, or file size. Use the search box to filter by file name or extension.
              </div>
            ) : null}

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {paged.map((photo) => (
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
                        loading="lazy"
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

            {filtered.length === 0 ? (
              <p className="mt-6 text-center text-sm text-[#697586]">No photos match your search.</p>
            ) : null}

            {totalPages > 1 ? (
              <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-9 rounded-lg border border-[#D7DDE4] bg-white px-3 text-sm font-medium text-[#334155] disabled:opacity-40 hover:bg-[#F5F7F8]"
                >
                  Previous
                </button>
                <span className="px-2 text-sm text-[#697586]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-9 rounded-lg border border-[#D7DDE4] bg-white px-3 text-sm font-medium text-[#334155] disabled:opacity-40 hover:bg-[#F5F7F8]"
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
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
