'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { flush, pendingCount, subscribeToOutbox } from '@/lib/offline/outbox';
import { registerOfflineHandlers } from '@/lib/offline/handlers';

interface OfflineContextValue {
  online: boolean;
  pending: number;
  sync: () => void;
}

const OfflineContext = createContext<OfflineContextValue>({
  online: false,
  pending: 0,
  sync: () => undefined,
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(false);
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount());
  }, []);

  const sync = useCallback(() => {
    if (!navigator.onLine || !pathname?.startsWith('/dashboard')) return;
    void flush().then(refreshPending);
  }, [pathname, refreshPending]);

  useEffect(() => {
    registerOfflineHandlers();
    setOnline(navigator.onLine);

    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const unsubscribe = subscribeToOutbox(() => {
      void refreshPending();
    });

    // Replay anything left over from a previous session, then reflect the count.
    sync();
    void refreshPending();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribe();
    };
  }, [refreshPending, sync]);

  return (
    <OfflineContext.Provider value={{ online, pending, sync }}>{children}</OfflineContext.Provider>
  );
}
