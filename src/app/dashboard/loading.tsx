export default function DashboardLoading() {
  return (
    <div className="dashboard-skeleton min-h-screen bg-[var(--bg-base)] flex flex-col">
      {/* Header skeleton — mirrors the sticky header in page.tsx */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[var(--bg-base)]/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          {/* Logo placeholder */}
          <div className="skeleton-block h-6 w-24 rounded" />
          {/* Avatar placeholder */}
          <div className="skeleton-block h-8 w-8 rounded-full" />
        </div>
      </header>

      {/* Main content skeleton */}
      <main className="flex-1 relative z-10">
        <div className="mx-auto max-w-5xl px-6 py-10">
          {/* Welcome strip skeleton */}
          <div className="pb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              {/* Left: heading + subtitle */}
              <div className="space-y-2">
                <div className="skeleton-block h-8 w-64 rounded" />
                <div className="skeleton-block h-4 w-48 rounded mt-2" />
              </div>
              {/* Right: action button placeholder */}
              <div className="skeleton-block h-9 w-36 rounded-lg shrink-0" />
            </div>
            {/* Bottom divider */}
            <div className="mt-6 h-px bg-white/[0.06]" />
          </div>

          {/* Tab bar skeleton */}
          <div className="flex items-center gap-4 mt-8 border-b border-white/[0.06] pb-2.5">
            <div className="skeleton-block h-8 w-24 rounded-full" />
            <div className="skeleton-block h-8 w-24 rounded-full" />
            <div className="skeleton-block h-8 w-24 rounded-full" />
          </div>

          {/* Card grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3"
              >
                <div className="skeleton-block h-4 w-3/4 rounded" />
                <div className="skeleton-block h-3 w-1/2 rounded" />
                <div className="skeleton-block h-20 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
