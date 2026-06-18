import type React from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { getAgencyOverview } from '@/lib/agency-intelligence/loaders';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}): React.JSX.Element {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-[var(--text-quaternary)]">{hint}</p>
      ) : null}
    </div>
  );
}

function severityClassName(severity: string): string {
  if (severity === 'critical') return 'text-red-300 bg-red-500/10';
  if (severity === 'warning') return 'text-amber-300 bg-amber-500/10';
  return 'text-blue-300 bg-blue-500/10';
}

function tierClassName(tier: string | null): string {
  if (tier === 'red') return 'text-red-300 bg-red-500/10';
  if (tier === 'amber') return 'text-amber-300 bg-amber-500/10';
  if (tier === 'green') return 'text-emerald-300 bg-emerald-500/10';
  return 'text-[var(--text-quaternary)] bg-[var(--bg-hover)]';
}

function DataNote({ error, empty }: { error: string | null; empty: string }): React.JSX.Element {
  if (error) {
    return (
      <p className="text-xs text-amber-300">
        Not provisioned: <span className="font-mono">{error}</span>
      </p>
    );
  }
  return <p className="text-xs text-[var(--text-quaternary)]">{empty}</p>;
}

export default async function AgencyIntelligencePage(): Promise<React.JSX.Element> {
  const overview = await getAgencyOverview();

  const corpusCount = overview.corpusClients.rows.length;
  const latestRun = overview.latestRun.rows[0] ?? null;
  const latestInsight = overview.latestInsight.rows[0] ?? null;
  const trackerError = overview.trackerTotals.errors.length > 0
    ? overview.trackerTotals.errors[0] ?? null
    : null;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-8 py-10">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
              Agency Intelligence
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--text-tertiary)]">
              Fuses SaaSLaunch tracker truth (live landing analytics) with corpus truth
              (engagement snapshots) per client and emits evidence-backed internal insights.
              First execution slice — proof spine, not the full console.
            </p>
          </div>

          {/* Portfolio stat blocks */}
          <div className="grid gap-6 border-y border-[var(--border-default)] py-5 sm:grid-cols-3 lg:grid-cols-6">
            <StatBlock label="Corpus clients" value={corpusCount} hint={overview.corpusClients.error ? 'table not provisioned' : 'sl_corpus_clients_current'} />
            <StatBlock label="Tracker clients" value={overview.trackerTotals.clients ?? '—'} hint={trackerError ? 'table not provisioned' : 'agency_clients'} />
            <StatBlock label="Tracker sites" value={overview.trackerTotals.sites ?? '—'} hint={trackerError ? 'table not provisioned' : 'agency_client_sites'} />
            <StatBlock label="Landing events" value={overview.trackerTotals.events ?? '—'} hint={trackerError ? 'table not provisioned' : 'landing_events'} />
            <StatBlock
              label="Latest refresh"
              value={latestRun ? latestRun.status : '—'}
              hint={latestRun ? `${latestRun.run_kind} · ${formatDateTime(latestRun.started_at)}` : overview.latestRun.error ?? 'no runs yet'}
            />
            <StatBlock
              label="Latest insight"
              value={latestInsight ? latestInsight.severity : '—'}
              hint={latestInsight ? latestInsight.client_slug : overview.latestInsight.error ?? 'none persisted'}
            />
          </div>

          {/* Corpus freshness */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Corpus freshness
            </h2>
            {latestRun ? (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 font-mono text-xs">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                  <span><span className="text-[var(--text-quaternary)]">run_kind:</span> {latestRun.run_kind}</span>
                  <span><span className="text-[var(--text-quaternary)]">status:</span> {latestRun.status}</span>
                  <span><span className="text-[var(--text-quaternary)]">clients:</span> {latestRun.client_count}</span>
                  <span><span className="text-[var(--text-quaternary)]">started:</span> {formatDateTime(latestRun.started_at)}</span>
                  <span><span className="text-[var(--text-quaternary)]">finished:</span> {formatDateTime(latestRun.finished_at)}</span>
                  <span className="col-span-2"><span className="text-[var(--text-quaternary)]">manifest:</span> {latestRun.manifest_hash}</span>
                  {latestRun.error_message ? (
                    <span className="col-span-4 text-red-300">error: {latestRun.error_message}</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <DataNote error={overview.latestRun.error} empty="No refresh runs recorded yet. Run `npm run agency:sync-corpus` to snapshot the corpus." />
            )}
          </section>

          {/* Latest insight */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Latest insight
            </h2>
            {latestInsight ? (
              <Link
                href={`/internal/agency/${latestInsight.client_slug}`}
                className="block rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 hover:border-[var(--accent-green)]"
              >
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${severityClassName(latestInsight.severity)}`}>
                    {latestInsight.severity}
                  </span>
                  <span className="text-[11px] text-[var(--text-quaternary)]">{latestInsight.client_slug}</span>
                  <span className="ml-auto text-[11px] text-[var(--text-quaternary)]">{formatDateTime(latestInsight.generated_at)}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--text-primary)]">{latestInsight.headline}</p>
              </Link>
            ) : (
              <DataNote error={overview.latestInsight.error} empty="No insights persisted yet. Open a client to compute a live client-health insight." />
            )}
          </section>

          {/* Client list */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Clients ({corpusCount})
            </h2>
            {overview.corpusClients.rows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-hover)] text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                    <tr>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Risk</th>
                      <th className="px-3 py-2 text-right">Churn</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                      <th className="px-3 py-2 text-right">Promises</th>
                      <th className="px-3 py-2 text-right">Gaps</th>
                      <th className="px-3 py-2 text-right">Fathom</th>
                      <th className="px-3 py-2 text-left">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {overview.corpusClients.rows.map((c) => (
                      <tr key={c.client_slug} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-3 py-2">
                          <Link href={`/internal/agency/${c.client_slug}`} className="font-medium text-[var(--text-primary)] hover:underline">
                            {c.client_display_name ?? c.client_slug}
                          </Link>
                          <span className="ml-2 text-[11px] text-[var(--text-quaternary)]">{c.client_slug}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-[11px] ${tierClassName(c.risk_tier)}`}>
                            {c.risk_tier ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{c.churn_score ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{c.actions_count}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{c.promises_count}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{c.gaps_count}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{c.fathom_meetings_count}</td>
                        <td className="px-3 py-2 text-[11px] text-[var(--text-quaternary)]">{formatDateTime(c.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <DataNote
                error={overview.corpusClients.error}
                empty="No corpus clients synced yet. Run `npm run agency:sync-corpus` to populate."
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}