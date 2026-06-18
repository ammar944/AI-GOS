import type React from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/shell/app-sidebar';
import type { Evidence, Locator } from '@/lib/agency-intelligence/contracts';
import { getClientDetail } from '@/lib/agency-intelligence/loaders';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

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

function statusClassName(status: string): string {
  if (status === 'verified') return 'text-emerald-300 bg-emerald-500/10';
  if (status === 'installed') return 'text-blue-300 bg-blue-500/10';
  if (status === 'error') return 'text-red-300 bg-red-500/10';
  if (status === 'disabled') return 'text-[var(--text-quaternary)] bg-[var(--bg-hover)]';
  return 'text-amber-300 bg-amber-500/10';
}

function severityClassName(severity: string): string {
  if (severity === 'critical') return 'text-red-300 bg-red-500/10';
  if (severity === 'warning') return 'text-amber-300 bg-amber-500/10';
  return 'text-blue-300 bg-blue-500/10';
}

// Verbal-signal severity tokens: high=red, medium=amber, low=blue.
function signalSeverityClassName(severity: string): string {
  if (severity === 'high') return 'text-red-300 bg-red-500/10';
  if (severity === 'medium') return 'text-amber-300 bg-amber-500/10';
  return 'text-blue-300 bg-blue-500/10';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}

/** Recording link: `source_metadata.share_url ?? source_metadata.call_url` (spec §8). */
function recordingUrl(meta: Record<string, unknown>): string | null {
  if (typeof meta.share_url === 'string' && meta.share_url) return meta.share_url;
  if (typeof meta.call_url === 'string' && meta.call_url) return meta.call_url;
  return null;
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
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
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

function LocatorText({ locator }: { locator: Locator }): React.JSX.Element {
  if (locator.type === 'db_row') {
    return (
      <span className="font-mono text-[11px] text-[var(--text-quaternary)]">
        {locator.table}.{locator.column ?? 'id'} = {locator.id}
      </span>
    );
  }
  if (locator.type === 'db_key') {
    return (
      <span className="font-mono text-[11px] text-[var(--text-quaternary)]">
        {locator.table}.{locator.key_column} = {locator.key_value}
        {locator.column ? ` (${locator.column})` : ''}
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] text-[var(--text-quaternary)]">
      {locator.path}
      {locator.pointer ? ` → ${locator.pointer}` : ''}
    </span>
  );
}

function kindClassName(kind: Evidence['kind']): string {
  if (kind === 'landing_event' || kind === 'corpus_action') return 'text-blue-300 bg-blue-500/10';
  if (kind === 'landing_rejection' || kind === 'corpus_gap') return 'text-amber-300 bg-amber-500/10';
  if (kind === 'site_registry' || kind === 'corpus_client') return 'text-emerald-300 bg-emerald-500/10';
  if (kind === 'corpus_promise' || kind === 'corpus_call') return 'text-purple-300 bg-purple-500/10';
  return 'text-[var(--text-quaternary)] bg-[var(--bg-hover)]';
}

export default async function AgencyClientPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const detail = await getClientDetail(slug);

  const corpus = detail.corpus.row;
  const insight = detail.insight.insight;
  const clientName = corpus?.client_display_name ?? detail.clientRow.row?.display_name ?? slug;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-8 px-8 py-10">
          <div>
            <Link href="/internal/agency" className="text-xs text-[var(--accent-green)] hover:underline">
              ← Agency Intelligence
            </Link>
            <h1 className="mt-2 font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
              {clientName}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-quaternary)] font-mono">{slug}</p>
          </div>

          {/* Live client-health insight */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Client-health insight (computed live)
            </h2>
            {insight ? (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${severityClassName(insight.severity)}`}>
                    {insight.severity}
                  </span>
                  <span className="text-[11px] text-[var(--text-quaternary)]">{insight.insight_kind}</span>
                  <span className="ml-auto text-[11px] text-[var(--text-quaternary)]">{formatDateTime(insight.generated_at)}</span>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{insight.headline}</p>
                <p className="text-sm text-[var(--text-tertiary)]">{insight.body}</p>

                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                    Evidence ({insight.evidence.length})
                  </p>
                  <ul className="space-y-1.5">
                    {insight.evidence.map((e, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[var(--border-default)] px-3 py-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${kindClassName(e.kind)}`}>
                          {e.kind}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)]">{e.summary}</span>
                        <span className="ml-auto">
                          <LocatorText locator={e.locator} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <DataNote
                error={detail.insight.error}
                empty="No corpus truth synced for this client — cannot compute a live insight. Run `npm run agency:sync-corpus`."
              />
            )}
          </section>

          {/* Tracker truth */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Tracker truth
            </h2>
            {detail.trackerErrors.length > 0 ? (
              <DataNote error={detail.trackerErrors[0] ?? null} empty="" />
            ) : detail.tracker.sites.length > 0 ? (
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatBlock label="Sites" value={detail.tracker.sites.length} />
                  <StatBlock label="Total events" value={detail.tracker.total_events} />
                  <StatBlock label="Rejections" value={detail.tracker.total_rejections} />
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-hover)] text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                      <tr>
                        <th className="px-3 py-2 text-left">Site</th>
                        <th className="px-3 py-2 text-left">Tracker</th>
                        <th className="px-3 py-2 text-right">Events</th>
                        <th className="px-3 py-2 text-right">Rejections</th>
                        <th className="px-3 py-2 text-left">Last event</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)]">
                      {detail.tracker.sites.map((s) => (
                        <tr key={s.site_id}>
                          <td className="px-3 py-2 font-mono">{s.site_slug}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-2 py-0.5 text-[11px] ${statusClassName(s.tracker_status)}`}>
                              {s.tracker_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">{s.event_count}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">{s.rejection_count}</td>
                          <td className="px-3 py-2 text-[11px] text-[var(--text-quaternary)]">{formatDateTime(s.last_event_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <DataNote
                error={detail.clientRow.error}
                empty="No tracker sites registered for this client (verified absent — not a missing query)."
              />
            )}
          </section>

          {/* Corpus truth */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Corpus truth
            </h2>
            {corpus ? (
              <div className="space-y-3">
                <div className="grid gap-4 border-y border-[var(--border-default)] py-4 sm:grid-cols-4 lg:grid-cols-5">
                  <StatBlock label="Risk tier" value={corpus.risk_tier ?? '—'} />
                  <StatBlock label="Churn" value={corpus.churn_score ?? '—'} />
                  <StatBlock label="Gap" value={corpus.gap_score ?? '—'} />
                  <StatBlock label="Actions" value={corpus.actions_count} />
                  <StatBlock label="Promises" value={corpus.promises_count} />
                  <StatBlock label="Gaps" value={corpus.gaps_count} />
                  <StatBlock label="Fathom" value={corpus.fathom_meetings_count} />
                  <StatBlock label="Sources" value={corpus.sources_total ?? '—'} />
                  <StatBlock label="Captured" value={formatDateTime(corpus.captured_at)} />
                  <StatBlock label="Updated" value={formatDateTime(corpus.updated_at)} />
                </div>
                <p className="font-mono text-[11px] text-[var(--text-quaternary)]">
                  manifest: {corpus.manifest_hash}
                </p>
              </div>
            ) : (
              <DataNote
                error={detail.corpus.error}
                empty="No corpus snapshot synced for this client."
              />
            )}
          </section>

          {/* Verbal signals (from calls) — extracted Fathom escalations (spec §8.3).
              Honest empty state when none; "Not provisioned" when the table is absent. */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Verbal signals (from calls)
            </h2>
            {detail.fathomSignals.error ? (
              <DataNote error={detail.fathomSignals.error} empty="" />
            ) : detail.fathomSignals.rows.length > 0 ? (
              <ul className="space-y-2">
                {detail.fathomSignals.rows.map((sig) => {
                  const link = recordingUrl(sig.source_metadata);
                  return (
                    <li
                      key={sig.id}
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${signalSeverityClassName(sig.severity)}`}>
                          {sig.severity}
                        </span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{sig.signal_type}</span>
                        <span className="ml-auto text-[11px] text-[var(--text-quaternary)]">{formatDate(sig.call_date)}</span>
                      </div>
                      <blockquote className="mt-2 border-l-2 border-[var(--border-default)] pl-3 text-sm italic text-[var(--text-tertiary)]">
                        “{sig.quote}”
                      </blockquote>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-quaternary)]">
                        <span>{sig.speaker ?? 'unknown speaker'}</span>
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--accent-green)] hover:underline"
                          >
                            recording ↗
                          </a>
                        ) : null}
                        <span className="ml-auto font-mono">
                          sl_fathom_signals.id = {sig.id} · rec {sig.recording_id}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <DataNote
                error={null}
                empty="No attributed Fathom risk signals extracted for this client."
              />
            )}
          </section>

          {/* Persisted insight history */}
          {detail.persistedInsights.rows.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Persisted insights ({detail.persistedInsights.rows.length})
              </h2>
              <ul className="space-y-2">
                {detail.persistedInsights.rows.map((pi) => (
                  <li key={pi.id} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
                    <div className="flex items-center gap-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${severityClassName(pi.severity)}`}>
                        {pi.severity}
                      </span>
                      <span className="ml-auto text-[11px] text-[var(--text-quaternary)]">{formatDateTime(pi.generated_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{pi.headline}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}