'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const TRICKLE_MS = 240;
const HIDE_MS = 320;
const MAX_MS = 8000;

/**
 * A slim top progress bar that appears the moment an in-app navigation starts
 * and fills to 100% as it finishes, so owners, visitors and the auth screens
 * always get feedback that a process is running — without a full page reload.
 *
 * App Router exposes no navigation event, so the bar starts on an internal link
 * click (capture phase) or back/forward (popstate) and completes when the
 * pathname settles — by which point the destination's `loading.tsx` or streamed
 * content is already on screen. A hard ceiling resets the bar if a navigation
 * never completes, so it can never strand the UI.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ceiling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  const stopTimers = useCallback(() => {
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
    if (hide.current) {
      clearTimeout(hide.current);
      hide.current = null;
    }
    if (ceiling.current) {
      clearTimeout(ceiling.current);
      ceiling.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    stopTimers();
    running.current = true;
    setActive(true);
    setProgress(8);
    trickle.current = setInterval(() => {
      setProgress((value) => (value >= 90 ? value : value + Math.max(0.6, (90 - value) * 0.08)));
    }, TRICKLE_MS);
    // Never let a navigation that never completes leave the bar stranded.
    ceiling.current = setTimeout(() => {
      running.current = false;
      setActive(false);
      setProgress(0);
    }, MAX_MS);
  }, [stopTimers]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Only same-origin page transitions; file/API routes do not change the URL.
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith('/api/')) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      begin();
    }

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', begin);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', begin);
      stopTimers();
    };
  }, [begin, stopTimers]);

  // The pathname settling means the destination has rendered (its loading.tsx or
  // streamed content is on screen): complete the bar, then fade it out.
  useEffect(() => {
    if (!running.current) return;
    stopTimers();
    running.current = false;
    setProgress(100);
    hide.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, HIDE_MS);
  }, [pathname, stopTimers]);

  return (
    <div className="route-progress" data-active={active} aria-hidden="true">
      <div className="route-progress__bar" style={{ transform: `scaleX(${progress / 100})` }} />
    </div>
  );
}
