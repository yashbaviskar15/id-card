'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/db/browser';

/**
 * One save usually touches several tables, so bursts of invalidations are
 * coalesced into a single refresh.
 */
const EVENT_COALESCE_MS = 120;
/** First delay of the safety poll that covers a Realtime outage. */
const FALLBACK_BASE_MS = 1_000;
/**
 * Ceiling for the safety poll. Realtime is the primary path and delivers within
 * a second; the poll only exists for the case where the channel cannot
 * subscribe. It must back off, because a full `router.refresh()` re-runs
 * middleware auth, the dashboard layout, and the page queries — polling that
 * every second turns into a request storm that competes with normal navigation
 * and makes every link feel slow.
 */
const FALLBACK_MAX_MS = 5_000;
const OWNER_TABLES = new Set([
  'profiles',
  'fields',
  'categories',
  'documents',
  'share_links',
  'access_grants',
  'access_log',
  'owner_settings',
  'backup_recovery_codes',
]);

export function DashboardLiveSync({ ownerId }: { ownerId: string }) {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let connected = false;
    let refreshTimer: number | null = null;
    let fallbackTimer: number | null = null;
    let fallbackDelay = FALLBACK_BASE_MS;
    let lastRefreshAt = 0;
    const supabase = createBrowserSupabase();

    const refresh = () => {
      if (disposed || !navigator.onLine || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt < EVENT_COALESCE_MS) return;
      lastRefreshAt = now;
      router.refresh();
    };

    const scheduleRefresh = () => {
      if (disposed || refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, EVENT_COALESCE_MS);
    };

    const stopFallback = () => {
      if (fallbackTimer === null) return;
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    };

    // Self-scheduling so the gap can grow while the channel stays down.
    const armFallback = () => {
      if (disposed || fallbackTimer !== null) return;
      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = null;
        if (disposed || connected) return;
        refresh();
        fallbackDelay = Math.min(FALLBACK_MAX_MS, fallbackDelay * 2);
        armFallback();
      }, fallbackDelay);
    };

    const startFallback = (reset = false) => {
      if (disposed) return;
      if (reset) {
        fallbackDelay = FALLBACK_BASE_MS;
        stopFallback();
      }
      armFallback();
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    startFallback();

    try {
      channel = supabase
        .channel(`owner:${ownerId}`, { config: { private: true } })
        .on('broadcast', { event: 'owner.invalidate' }, (message) => {
          const table = message.payload?.table;
          if (typeof table === 'string' && OWNER_TABLES.has(table)) scheduleRefresh();
        })
        .subscribe((status) => {
          if (disposed) return;
          connected = status === 'SUBSCRIBED';
          if (connected) {
            stopFallback();
            scheduleRefresh();
          } else {
            // Back off across the client's own reconnect attempts instead of
            // restarting a one-second poll each time one fails.
            startFallback();
          }
        });
    } catch {
      connected = false;
      startFallback();
    }

    // Whenever the owner comes back to the tab or regains the network, read
    // fresh data straight away (and let the poll resume from its base delay).
    const refreshWhenActive = () => {
      if (document.visibilityState !== 'visible') return;
      startFallback(true);
      scheduleRefresh();
    };
    const refreshWhenOnline = () => {
      startFallback(true);
      scheduleRefresh();
    };
    document.addEventListener('visibilitychange', refreshWhenActive);
    window.addEventListener('focus', refreshWhenActive);
    window.addEventListener('online', refreshWhenOnline);

    return () => {
      disposed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      stopFallback();
      document.removeEventListener('visibilitychange', refreshWhenActive);
      window.removeEventListener('focus', refreshWhenActive);
      window.removeEventListener('online', refreshWhenOnline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [ownerId, router]);

  return null;
}
