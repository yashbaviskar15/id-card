'use client';

import { useEffect, useRef, useState } from 'react';

function format(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Counts down to a fixed server-issued instant. The target is an absolute
 * timestamp, never a duration, so a reload or a suspended tab cannot extend it.
 */
export function Countdown({
  until,
  onExpire,
  className,
}: {
  until: string;
  onExpire?: () => void;
  className?: string;
}) {
  const target = Date.parse(until);
  // Start empty so the server and the first client render agree, then fill in.
  const [remaining, setRemaining] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    let expired = false;
    const tick = () => {
      const next = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0 && !expired) {
        expired = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <span className={className} suppressHydrationWarning>
      {remaining === null ? '–:––' : format(remaining)}
    </span>
  );
}
