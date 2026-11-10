'use client';

import { usePathname } from 'next/navigation';

/**
 * Re-runs the shared entrance animation whenever the dashboard route changes.
 * The layout itself is persistent, so the animation has to hang off the page
 * content: keying on the pathname remounts exactly that subtree after a
 * navigation. Motion is defined in globals.css and is disabled globally under
 * `prefers-reduced-motion`, so this stays inert for anyone who opts out.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-enter min-w-0">
      {children}
    </div>
  );
}
