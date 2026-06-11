import type React from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { getSaasLaunchOverview } from '@/lib/saaslaunch/dashboard';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null): string {
  if (!value) return 'No events yet';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function statusClassName(status: string): string {
  if (status === 'verified') return 'text-emerald-300 bg-emerald-500/10';
  if (status === 'installed') return 'text-blue-300 bg-blue-500/10';
  if (status === 'error') return 'text-red-300 bg-red-500/10';
  if (status === 'disabled') return 'text-[var(--text-quaternary)] bg-[var(--bg-hover)]';
  return 'text-amber-300 bg-amber-500/10';
}

function StatBlock({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): React.JSX.Element {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

export default async function SaasLaunchInternalPage(): Promise<React.JSX.Element> {
  const overview = await getSaasLaunchOverview();

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-8 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
                SaaSLaunch
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-[var(--text-tertiary)]">
                Internal inventory for deployed landing pages, event registries, tracker proof,
                and page-specific conversion analytics.
              </p>
            </div>
            <Link
              href="/internal/clients"
              className="text-sm text-[var(--accent-green)] underline-offset-2 hover:underline"
            >
              Client accounts
            </Link>
          </div>

          <div className="grid gap-6 border-y border-[var(--border-default)] py-5 sm:grid-cols-3 lg:grid-cols-6">
            <StatBlock label="Clients" value={overview.totals.clients} />
            <StatBlock label="Sites" value={overview.totals.sites} />
            <StatBlock label="Events" value={overview.totals.events} />
            <StatBlock label="Sessions" value={overview.totals.uniqueSessions} />
            <StatBlock label="Conversions" value={overview.totals.conversions} />
            <StatBlock label="Rejected" value={overview.totals.rejections} />
          </div>

          <section className="space-y-3">
            <div>
              <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
                Deployed Pages
              </h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                Seeded from the current `saaslaunch` Vercel inventory. NexOne remains unseeded
                until deployment ownership is verified.
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-hover)] text-left text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Page</th>
                    <th className="px-4 py-3 font-medium">Purpose</th>
                    <th className="px-4 py-3 font-medium">Tracker</th>
                    <th className="px-4 py-3 font-medium text-right">Events</th>
                    <th className="px-4 py-3 font-medium text-right">Conversions</th>
                    <th className="px-4 py-3 font-medium">Last Event</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.sites.map((site) => (
                    <tr
                      key={site.id}
                      className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/internal/saaslaunch/clients/${site.clientSlug}`}
                          className="text-[var(--text-primary)] hover:text-[var(--accent-green)]"
                        >
                          {site.clientDisplayName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={site.liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent-green)] underline-offset-2 hover:underline"
                        >
                          {site.displayName}
                        </a>
                      </td>
                      <td className="max-w-sm px-4 py-3 text-[var(--text-tertiary)]">
                        {site.pagePurpose}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${statusClassName(site.effectiveTrackerStatus)}`}
                        >
                          {site.effectiveTrackerStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {site.totalEvents}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {site.conversionEvents}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-tertiary)]">
                        {formatDateTime(site.lastEventAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
                Recent Accepted Events
              </h2>
              <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-hover)] text-left text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Event</th>
                      <th className="px-4 py-3 font-medium">Path</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentEvents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-quaternary)]">
                          No accepted events yet.
                        </td>
                      </tr>
                    ) : (
                      overview.recentEvents.map((event) => (
                        <tr
                          key={event.id}
                          className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
                        >
                          <td className="px-4 py-3 font-mono text-xs">{event.eventKey}</td>
                          <td className="px-4 py-3">{event.path}</td>
                          <td className="px-4 py-3 text-[var(--text-tertiary)]">
                            {event.utmSource ?? 'direct'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--text-tertiary)]">
                            {formatDateTime(event.occurredAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
                Rejection Inbox
              </h2>
              <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-hover)] text-left text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Event</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentRejections.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-quaternary)]">
                          No rejected events.
                        </td>
                      </tr>
                    ) : (
                      overview.recentRejections.map((rejection) => (
                        <tr
                          key={rejection.id}
                          className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
                        >
                          <td className="px-4 py-3 font-mono text-xs">
                            {rejection.eventKey ?? 'unknown'}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-[var(--text-tertiary)]">
                            {rejection.reason}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--text-tertiary)]">
                            {formatDateTime(rejection.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
