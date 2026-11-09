'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOffline } from './offline-provider';

/**
 * Shown in place of an action that fundamentally needs the server (file
 * uploads, access codes, exports). Data edits are queued offline instead, so
 * only these network-bound actions are gated.
 */
export function OnlineRequiredNotice({
  children = 'This needs an internet connection. Try again once you are back online.',
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { online } = useOffline();
  if (online !== false) return null;
  return (
    <Alert className={className}>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
