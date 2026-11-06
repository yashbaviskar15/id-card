'use client';

import { useRouter } from 'next/navigation';
import { Countdown } from '@/components/countdown';
import { Clock3 } from 'lucide-react';

/**
 * Shows the remaining session time and reloads the page the moment it runs out,
 * which puts the lock screen back without the visitor doing anything.
 */
export function SessionTimer({ until }: { until: string }) {
  const router = useRouter();
  return (
    <div
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-hairline bg-muted/70 px-3 py-2 text-xs text-label sm:text-sm"
      role="timer"
      aria-label="Time remaining in this access session"
    >
      <Clock3 className="h-4 w-4 shrink-0 text-label" aria-hidden="true" />
      <span className="whitespace-nowrap">Session ends in</span>
      <Countdown
        until={until}
        onExpire={() => router.refresh()}
        className="font-semibold tabular-nums text-ink"
      />
    </div>
  );
}
