'use client';

import { useRouter } from 'next/navigation';
import { Countdown } from '@/components/countdown';

/**
 * Shows the remaining session time and reloads the page the moment it runs out,
 * which puts the lock screen back without the visitor doing anything.
 */
export function SessionTimer({ until }: { until: string }) {
  const router = useRouter();
  return (
    <p className="text-sm text-label">
      This view closes in{' '}
      <Countdown until={until} onExpire={() => router.refresh()} className="font-semibold text-ink" />
    </p>
  );
}
