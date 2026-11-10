'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/db/browser';

const REFRESH_FALLBACK_MS = 1_000;
const INVALIDATION_COALESCE_MS = 120;
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
    let lastRefreshAt = 0;
    const supabase = createBrowserSupabase();

    const refresh = () => {
      if (disposed || !navigator.onLine || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt < INVALIDATION_COALESCE_MS) return;
      lastRefreshAt = now;
      router.refresh();
    };

    const scheduleRefresh = () => {
      if (disposed || refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, INVALIDATION_COALESCE_MS);
    };

    const startFallback = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(() => {
        if (!connected) refresh();
      }, REFRESH_FALLBACK_MS);
    };

    const stopFallback = () => {
      if (fallbackTimer === null) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
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
            startFallback();
          }
        });
    } catch {
      connected = false;
      startFallback();
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    const refreshWhenOnline = () => scheduleRefresh();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshWhenOnline);

    return () => {
      disposed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      stopFallback();
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenOnline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [ownerId, router]);

  return null;
}
