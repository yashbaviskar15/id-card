'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function ShareLiveSync({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource(`/s/${encodeURIComponent(token)}/stream`);
    const refresh = () => router.refresh();
    source.addEventListener('update', refresh);
    source.addEventListener('ended', () => {
      refresh();
      source.close();
    });
    return () => {
      source.close();
    };
  }, [router, token]);

  return null;
}
