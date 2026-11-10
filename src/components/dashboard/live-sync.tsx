'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 1_000;

function isEditing(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement
    && (active.isContentEditable || active.matches('input, textarea, select'));
}

export function DashboardLiveSync() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    const refreshIfSafe = () => {
      if (!navigator.onLine || document.visibilityState !== 'visible' || isEditing() || isRefreshing) return;
      startTransition(() => router.refresh());
    };

    const timer = window.setInterval(refreshIfSafe, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshIfSafe);
    document.addEventListener('visibilitychange', refreshIfSafe);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfSafe);
      document.removeEventListener('visibilitychange', refreshIfSafe);
    };
  }, [isRefreshing, router, startTransition]);

  return null;
}
