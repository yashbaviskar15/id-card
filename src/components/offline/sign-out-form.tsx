'use client';

import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { useOffline } from '@/components/offline/offline-provider';
import { clearAppOfflineData } from '@/lib/offline/clear';

/**
 * Only clear local queue/cache after the server confirms sign-out. Offline sign-out
 * cannot revoke the server session, so leave queued edits intact.
 */
export function SignOutForm({ children, className }: { children: ReactNode; className?: string }) {
  const [pending, setPending] = useState(false);
  const { online } = useOffline();

  return (
    <form
      action="/auth/signout"
      method="post"
      className={className}
      aria-busy={pending || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (!online) {
          toast.error('Reconnect before signing out so the server session can be revoked safely.');
          return;
        }
        if (pending) return;
        setPending(true);
        void (async () => {
          try {
            const response = await fetch('/auth/signout', {
              method: 'POST',
              cache: 'no-store',
              credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('Sign-out failed.');
            await clearAppOfflineData();
            window.location.assign('/login');
          } catch {
            setPending(false);
            toast.error('Could not sign out. Your local queued changes were kept; try again.');
          }
        })();
      }}
    >
      {children}
    </form>
  );
}
