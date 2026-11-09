'use client';

import { type ReactNode, useRef } from 'react';
import { clearAppOfflineData } from '@/lib/offline/clear';

/**
 * Sign-out form that wipes cached pages and queued edits before the POST to
 * `/auth/signout` goes through, so no owner data survives on a shared device.
 */
export function SignOutForm({ children, className }: { children: ReactNode; className?: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action="/auth/signout"
      method="post"
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void clearAppOfflineData().finally(() => formRef.current?.submit());
      }}
    >
      {children}
    </form>
  );
}
