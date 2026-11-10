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
  serverNow,
  onExpire,
  className,
}: {
  until: string;
  serverNow?: string;
  onExpire?: () => void;
  className?: string;
}) {
  const target = Date.parse(until);
  const serverTarget = serverNow ? Date.parse(serverNow) : Number.NaN;
  // Start empty so the server and the first client render agree, then fill in.
  const [remaining, setRemaining] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    let expired = false;
    const startedAt = performance.now();
    const initialRemaining = target - (Number.isFinite(serverTarget) ? serverTarget : Date.now());
    const expire = () => {
      if (expired) return;
      expired = true;
      setRemaining(0);
      onExpireRef.current?.();
    };
    const tick = () => {
      const remainingMs = initialRemaining - (performance.now() - startedAt);
      if (remainingMs <= 0) {
        expire();
        return;
      }
      const next = Math.max(0, Math.ceil(remainingMs / 1000));
      setRemaining(next);
    };
    tick();
    const id = setInterval(tick, 1000);
    const expiryId = setTimeout(expire, Math.max(0, initialRemaining));
    return () => {
      clearInterval(id);
      clearTimeout(expiryId);
    };
  }, [serverTarget, target]);

  return (
    <span className={className} suppressHydrationWarning>
      {remaining === null ? '–:––' : format(remaining)}
    </span>
  );
}
