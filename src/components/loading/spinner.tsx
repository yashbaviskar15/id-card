import { LoaderCircle } from 'lucide-react';
import { cn } from 'cn';

/**
 * Inline spinner for any in-flight process (buttons, panels, cards). Purely
 * presentational, so it can be used from both server and client components.
 * Motion is covered by the global `prefers-reduced-motion` rule; the always
 * visible label next to it is what actually communicates the state.
 */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}
