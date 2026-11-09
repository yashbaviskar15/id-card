'use client';

import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { useOffline } from '@/components/offline/offline-provider';
import { clearAppOfflineData } from '@/lib/offline/clear';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Only clear local queue/cache after the server confirms sign-out. Offline sign-out
 * cannot revoke the server session, so leave queued edits intact.
 */
export function SignOutForm({ children, className }: { children: ReactNode; className?: string }) {
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { online } = useOffline();

  async function signOut() {
    if (pending) return;
    if (!online) {
      toast.error('Reconnect before signing out so the server session can be revoked safely.');
      return;
    }
    setPending(true);
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
  }

  return (
    <>
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
          if (!pending) setConfirmOpen(true);
        }}
      >
        {children}
      </form>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              After sign-out succeeds, cached owner data and queued offline edits will be cleared from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void signOut()}
            >
              {pending ? 'Signing out...' : 'Sign out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
