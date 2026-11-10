'use client';

import { useRouter } from 'next/navigation';
import { Countdown } from '@/components/countdown';
import { Clock3 } from 'lucide-react';

/**
 * Shows the remaining session time and reloads the page the moment it runs out,
 * which puts the lock screen back without the visitor doing anything.
 */
export function SessionTimer({ until, serverNow }: { until: string; serverNow: string }) {
  const router = useRouter();
  return (
    <div
      className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#064E46] px-3 py-2 text-xs font-medium text-[#A7F3D0] sm:text-sm"
      role="timer"
      aria-label="Time remaining in this access session"
    >
      <Clock3 className="h-5 w-5 shrink-0 text-[#A7F3D0]" strokeWidth={1.8} aria-hidden="true" />
      <span className="whitespace-nowrap">Session ends in</span>
      <Countdown
        until={until}
        serverNow={serverNow}
        onExpire={() => router.refresh()}
        className="font-semibold tabular-nums text-[#A7F3D0]"
      />
    </div>
  );
}
