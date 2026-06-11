import type React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppSidebar } from '@/components/shell/app-sidebar';
import {
  buildTrackerSnippet,
  getSaasLaunchClientDetail,
  type SaasLaunchClientDetail,
  type SaasLaunchEventRow,
  type SaasLaunchSiteSummary,
} from '@/lib/saaslaunch/dashboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface SourcePerformanceRow {
  source: string;
  medium: string;
  campaign: string;
  events: number;
  conversions: number;
}

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

function eventIsConversion(
  event: SaasLaunchEventRow,
  client: SaasLaunchClientDetail,
): boolean {
  return client.sites.some((site): boolean =>
    site.eventDefinitions.some(
      (definition): boolean =>
        definition.id === event.eventDefinitionId && definition.isConversion,
    ),
  );
}

function sourcePerformanceRows(client: SaasLaunchClientDetail): SourcePerformanceRow[] {
  const rows = new Map<string, SourcePerformanceRow>();

  for (const event of client.recentEvents) {
    const source = event.utmSource ?? 'direct';
    const medium = event.utmMedium ?? 'none';
    const campaign = event.utmCampaign ?? 'none';
    const key = `${source}::${medium}::${campaign}`;
    const existing =
      rows.get(key) ??
      {
        source,
        medium,
        campaign,
        events: 0,
        conversions: 0,
      };

    rows.set(key, {
      ...existing,
      events: existing.events + 1,
      conversions: existing.conversions + (eventIsConversion(event, client) ? 1 : 0),
    });
  }

  return [...rows.values()].sort((a, b): number => b.events - a.events);
}

function debugPayload(site: SaasLaunchSiteSummary): string {
  const origin = site.allowedOrigins[0] ?? site.liveUrl;
  return JSON.stringify(
    {
      event_name: 'page_viewed',
      client_slug: site.clientSlug,
      site_slug: site.slug,
      page_url: `${origin}/?utm_source=debug`,
      path: '/',
      occurred_at: new Date().toISOString(),
      session_id: 'sl_debug_session',
      utm_source: 'debug',
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      referrer: null,
      device_type: 'desktop',
      browser: 'debug',
      properties: {},
    },
    null,
    2,
  );
}

function SiteSection({
  site,
  client,
}: {
  site: SaasLaunchSiteSummary;
  client: SaasLaunchClientDetail;
}): React.JSX.Element {
  const events = client.recentEvents.filter(
    (event): boolean => event.siteId === site.id,
  );
  const rejections = client.recentRejections.filter(
    (rejection): boolean => rejection.siteSlug === site.slug,
  );
  const endpointOrigin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://aigos.saaslaunch.com';

  return (
    <section className="space-y-5 border-t border-[var(--border-default)] pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            {site.displayName}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-tertiary)]">
            {site.pagePurpose}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${statusClassName(site.effectiveTrackerStatus)}`}
        >
          {site.effectiveTrackerStatus}
        </span>
      </div>

      <div className="grid gap-6 border-y border-[var(--border-default)] py-4 sm:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
            Events
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
            {site.totalEvents}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
            Sessions
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
            {site.uniqueSessions}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
            Conversions
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
            {site.conversionEvents}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
            Last Event
          </p>
          <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">
            {formatDateTime(site.lastEventAt)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          Install Snippet
        </h3>
        <pre className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-xs text-[var(--text-secondary)]">
          <code>{buildTrackerSnippet({
            clientSlug: site.clientSlug,
            siteSlug: site.slug,
            appOrigin: endpointOrigin,
          })}</code>
        </pre>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          Event Registry
        </h3>
        <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-hover)] text-left text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Conversion</th>
                <th className="px-4 py-3 font-medium">Allowed Properties</th>
              </tr>
            </thead>
            <tbody>
              {site.eventDefinitions.map((definition) => (
                <tr
                  key={definition.id}
                  className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
                >
                  <td className="px-4 py-3 font-mono text-xs">{definition.eventKey}</td>
                  <td className="px-4 py-3">{definition.category}</td>
                  <td className="px-4 py-3">{definition.isConversion ? 'yes' : 'no'}</td>
                  <td className="px-4 py-3 text-[var(--text-tertiary)]">
                    {definition.properties.length === 0
                      ? 'none'
                      : definition.properties
                          .map((property): string => property.propertyKey)
                          .join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          Live Debugger Payload
        </h3>
        <pre className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-xs text-[var(--text-secondary)]">
          <code>{`curl -i '${endpointOrigin}/api/landing-events' \\
  -H 'content-type: application/json' \\
  -H 'origin: ${site.allowedOrigins[0] ?? site.liveUrl}' \\
  --data '${debugPayload(site)}'`}</code>
        </pre>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Recent Events
          </h3>
          <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-hover)] text-left text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Path</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-quaternary)]">
                      No events for this site yet.
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr
                      key={event.id}
                      className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{event.eventKey}</td>
                      <td className="px-4 py-3">{event.path}</td>
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

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Rejections
          </h3>
          <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-hover)] text-left text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejections.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-[var(--text-quaternary)]">
                      No rejected events for this site.
                    </td>
                  </tr>
                ) : (
                  rejections.map((rejection) => (
                    <tr
                      key={rejection.id}
                      className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {rejection.eventKey ?? 'unknown'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-tertiary)]">
                        {rejection.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function SaasLaunchClientPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const client = await getSaasLaunchClientDetail(slug);
  if (!client) notFound();

  const sourceRows = sourcePerformanceRows(client);

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-8 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                href="/internal/saaslaunch"
                className="text-sm text-[var(--accent-green)] underline-offset-2 hover:underline"
              >
                SaaSLaunch
              </Link>
              <h1 className="mt-2 font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
                {client.displayName}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                {client.sites.length} deployed landing page{client.sites.length === 1 ? '' : 's'}.
              </p>
            </div>
            <span className="rounded-full bg-[var(--bg-hover)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--text-tertiary)]">
              {client.status}
            </span>
          </div>

          <div className="grid gap-6 border-y border-[var(--border-default)] py-5 sm:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                Events
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                {client.totalEvents}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                Sessions
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                {client.uniqueSessions}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                Conversions
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                {client.conversionEvents}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                Last Event
              </p>
              <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                {formatDateTime(client.lastEventAt)}
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
              Source / Campaign Performance
            </h2>
            <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-hover)] text-left text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Medium</th>
                    <th className="px-4 py-3 font-medium">Campaign</th>
                    <th className="px-4 py-3 font-medium text-right">Events</th>
                    <th className="px-4 py-3 font-medium text-right">Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-quaternary)]">
                        No campaign data yet.
                      </td>
                    </tr>
                  ) : (
                    sourceRows.map((row) => (
                      <tr
                        key={`${row.source}-${row.medium}-${row.campaign}`}
                        className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
                      >
                        <td className="px-4 py-3">{row.source}</td>
                        <td className="px-4 py-3">{row.medium}</td>
                        <td className="px-4 py-3">{row.campaign}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {row.events}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {row.conversions}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {client.sites.map((site) => (
            <SiteSection key={site.id} site={site} client={client} />
          ))}
        </div>
      </main>
    </div>
  );
}
