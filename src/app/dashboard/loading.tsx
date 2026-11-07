export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading page…</span>
      <div className="motion-safe:animate-pulse">
        <div className="h-7 w-40 rounded-lg bg-hairline/70" />
        <div className="mt-3 h-4 max-w-xl rounded bg-hairline/50" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-32 rounded-2xl border border-hairline bg-white p-5 shadow-sm motion-safe:animate-pulse"
          >
            <div className="h-4 w-2/5 rounded bg-hairline/60" />
            <div className="mt-5 h-7 w-1/2 rounded bg-hairline/50" />
            <div className="mt-3 h-3 w-3/4 rounded bg-hairline/40" />
          </div>
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-hairline bg-white shadow-sm motion-safe:animate-pulse">
        <div className="border-b border-subtle-line p-5">
          <div className="h-4 w-36 rounded bg-hairline/60" />
        </div>
        <div className="space-y-4 p-5">
          <div className="h-10 rounded-lg bg-hairline/35" />
          <div className="h-10 rounded-lg bg-hairline/35" />
          <div className="h-10 rounded-lg bg-hairline/35" />
        </div>
      </div>
    </div>
  );
}
