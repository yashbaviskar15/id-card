'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { flush, pendingCount, subscribeToOutbox } from '@/lib/offline/outbox';
import { registerOfflineHandlers } from '@/lib/offline/handlers';

interface OfflineContextValue {
  online: boolean;
  pending: number;
  sync: () => void;
}

const OfflineContext = createContext<OfflineContextValue>({
  online: true,
  pending: 0,
  sync: () => undefined,
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount());
  }, []);

  const sync = useCallback(() => {
    void flush().then(refreshPending);
  }, [refreshPending]);

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
