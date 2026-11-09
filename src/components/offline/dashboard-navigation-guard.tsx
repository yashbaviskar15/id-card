'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function OfflineNavigationGuard() {
  useEffect(() => {
    const preventOfflineNavigation = (event: MouseEvent) => {
      if (navigator.onLine) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank') return;

      let destination: URL;
      try {
        destination = new URL(anchor.href);
      } catch {
        return;
      }
      if (destination.origin !== location.origin) return;
      if (destination.pathname === location.pathname && destination.hash) return;
      if (destination.pathname === '/offline') return;

      event.preventDefault();
      event.stopImmediatePropagation();
      toast.error('Reconnect to open another page or download a file. Private content is not cached offline.');
    };

    const preventOfflineServerAction = (event: SubmitEvent) => {
      if (navigator.onLine) return;
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      if (target.method.toLowerCase() === 'get' || target.dataset.offlineQueue === 'true') return;

      event.preventDefault();
      event.stopImmediatePropagation();
      toast.error('This action needs an internet connection. Your queued card or information edits are kept on this device.');
    };

    document.addEventListener('click', preventOfflineNavigation, true);
    document.addEventListener('submit', preventOfflineServerAction, true);
    return () => {
      document.removeEventListener('click', preventOfflineNavigation, true);
      document.removeEventListener('submit', preventOfflineServerAction, true);
    };
  }, []);

  return null;
}
