/**
 * Quiet, centered loading screen used by the route-level `loading.tsx` files
 * while a server component streams in. Shown to owners, visitors and the auth
 * screens alike, so a request that has to wait never looks like a blank or
 * frozen page — the process simply reports that it is running.
 */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="bg-page flex min-h-dvh w-full items-center justify-center px-6 py-16"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="animate-fade-in flex flex-col items-center gap-4">
        <span className="loader-ring" aria-hidden="true" />
        <span className="text-sm font-medium text-label">{label}</span>
      </div>
    </div>
  );
}
