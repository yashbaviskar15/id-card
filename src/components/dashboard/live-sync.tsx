'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 60_000;

function isEditing(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement
    && (active.isContentEditable || active.matches('input, textarea, select'));
}

export function DashboardLiveSync() {
  const router = useRouter();

  useEffect(() => {
    let lastRefresh = 0;

    const refreshIfSafe = () => {
      if (!navigator.onLine || document.visibilityState !== 'visible' || isEditing()) return;
      const now = Date.now();
      if (now - lastRefresh < 3_000) return;
      lastRefresh = now;
      router.refresh();
    };

    const timer = window.setInterval(refreshIfSafe, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshIfSafe);
    document.addEventListener('visibilitychange', refreshIfSafe);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfSafe);
      document.removeEventListener('visibilitychange', refreshIfSafe);
    };
  }, [router]);

  return null;
}
