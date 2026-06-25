import type React from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { getMetaAccountDetail } from '@/lib/agency-intelligence/meta/loaders';
import { MetaTrendCharts } from '@/components/internal/meta-ads-charts';
import type { SignalStatus } from '@/lib/agency-intelligence/meta/signals';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const money = (n: number | null): string => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);
const money2 = (n: number | null): string => (n == null ? '—' : `$${n.toFixed(2)}`);
const int = (n: number | null): string => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const pct = (n: number | null): string => (n == null ? '—' : `${n.toFixed(2)}%`);
const num = (n: number | null, d = 2): string => (n == null ? '—' : n.toFixed(d));

function objectiveLabel(o: string | null): string {
  if (!o) return '—';
  const map: Record<string, string> = {
    OUTCOME_LEADS: 'Leads',
    OUTCOME_TRAFFIC: 'Traffic',
    OUTCOME_SALES: 'Sales',
    OUTCOME_AWARENESS: 'Awareness',
    OUTCOME_ENGAGEMENT: 'Engagement',
    OUTCOME_APP_PROMOTION: 'App',
  };
  return map[o] ?? o;
}

function signalClass(status: SignalStatus): string {
  if (status === 'good') return 'text-emerald-300 bg-emerald-500/10';
  if (status === 'watch') return 'text-amber-300 bg-amber-500/10';
  if (status === 'poor') return 'text-red-300 bg-red-500/10';
  return 'text-[var(--text-quaternary)] bg-[var(--bg-hover)]';
}

function signalDisplay(key: string, value: number | null): string {
  if (value == null) return '—';
  if (key === 'frequency') return num(value);
  if (key === 'ctr') return pct(value);
  if (key === 'cpc' || key === 'cpm') return money2(value);
  if (key === 'creative_fatigue') return `${value > 0 ? '−' : '+'}${Math.abs(value).toFixed(0)}%`;
  return String(value);
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
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--text-quaternary)]">{hint}</p> : null}
    </div>
  );
}

export default async function MetaAdsAccountPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const detail = await getMetaAccountDetail(slug);

  const shell = (children: React.ReactNode) => (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-8 py-10">{children}</div>
      </main>
    </div>
  );

  const backLink = (
    <Link href="/internal/meta-ads" className="text-xs text-[var(--text-tertiary)] hover:underline">
      ← Meta Ads
    </Link>
  );

  if (!detail.account) {
    return shell(
      <div className="space-y-3">
        {backLink}
        <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
          {slug}
        </h1>
        <p className="text-xs text-amber-300">
          {detail.error ? (
            <>Not provisioned: <span className="font-mono">{detail.error}</span></>
          ) : (
            'No Meta ad account found for this client.'
          )}
        </p>
      </div>
    );
  }

  const { account, kpis, signals, campaigns, trend } = detail;
  const pending = !account.is_mcp_enabled || kpis == null;

  return shell(
    <>
      <div className="space-y-2">
        {backLink}
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
            {account.account_name ?? account.client_slug}
          </h1>
          <span className="font-mono text-[11px] text-[var(--text-quaternary)]">
            {account.client_slug} · {account.meta_account_id} · {account.currency ?? 'USD'}
          </span>
        </div>
        <p className="text-sm text-[var(--text-tertiary)]">
          Account-level KPIs over the last {kpis?.days ?? 0} days. Read-only Meta (FB + IG) insights;
          metrics Meta does not track for this objective render as &ldquo;—&rdquo;.
        </p>
      </div>

      {pending ? (
        <p className="text-xs text-amber-300">
          <span className="rounded bg-amber-500/10 px-2 py-0.5 font-medium">pending Meta MCP rollout</span>{' '}
          — this account is not yet MCP-enabled on Meta&rsquo;s side, so no insights are available.
        </p>
      ) : (
        <>
          {/* KPI tiles — full metric set; — when Meta returns "Not available". */}
          <div className="grid gap-6 border-y border-[var(--border-default)] py-5 sm:grid-cols-3 lg:grid-cols-6">
            <StatBlock label="Spend" value={money(kpis!.spend)} hint={`last ${kpis!.days}d`} />
            <StatBlock label="Impressions" value={int(kpis!.impressions)} />
            <StatBlock label="Reach" value={int(kpis!.reach)} />
            <StatBlock label="Frequency" value={num(kpis!.frequency)} hint="avg/day" />
            <StatBlock label="Clicks (all)" value={int(kpis!.clicks)} />
            <StatBlock label="Link clicks" value={int(kpis!.linkClicks)} hint="not exposed by MCP" />
            <StatBlock label="CTR (all)" value={pct(kpis!.ctr)} />
            <StatBlock label="CPC" value={money2(kpis!.cpc)} />
            <StatBlock label="CPM" value={money2(kpis!.cpm)} />
            <StatBlock label="Results" value={int(kpis!.results)} hint="account-level" />
            <StatBlock label="Cost / result" value={money2(kpis!.costPerResult)} />
            <StatBlock label="ROAS" value={num(kpis!.roas)} hint="purchase-tracked only" />
          </div>

          {/* Insight signals — benchmark-aware, no fabricated overall score. */}
          {signals ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Insight signals ({signals.computable}/{signals.total} computable)
                </h2>
                {signals.insufficientData ? (
                  <span className="text-[11px] text-amber-300">
                    Insufficient data — more than half of signals are N/A; not scored.
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {signals.signals.map((s) => (
                  <div
                    key={s.key}
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{s.label}</span>
                      <span className={`ml-auto rounded px-2 py-0.5 text-[11px] font-medium ${signalClass(s.status)}`}>
                        {s.status === 'unknown' ? 'n/a' : s.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                      {signalDisplay(s.key, s.value)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-quaternary)]">{s.benchmark}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{s.note}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-quaternary)]">
                Thresholds: <span className="font-mono">docs/reference/meta-ads-benchmarks.md</span>{' '}
                (benai ads-meta, WordStream/Triple Whale 2025). No overall health score is fabricated.
              </p>
            </section>
          ) : null}

          {/* Trend */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Daily trend
            </h2>
            <MetaTrendCharts trend={trend} />
          </section>

          {/* Per-campaign table */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Campaigns ({campaigns.length})
            </h2>
            {campaigns.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-hover)] text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                    <tr>
                      <th className="px-3 py-2 text-left">Campaign</th>
                      <th className="px-3 py-2 text-left">Objective</th>
                      <th className="px-3 py-2 text-right">Spend</th>
                      <th className="px-3 py-2 text-right">Impr.</th>
                      <th className="px-3 py-2 text-right">CTR</th>
                      <th className="px-3 py-2 text-right">CPC</th>
                      <th className="px-3 py-2 text-right">CPM</th>
                      <th className="px-3 py-2 text-right">Freq.</th>
                      <th className="px-3 py-2 text-right">Results</th>
                      <th className="px-3 py-2 text-right">Cost/result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {campaigns.map((c) => (
                      <tr key={c.campaign_id ?? c.campaign_name} className="align-top hover:bg-[var(--bg-hover)]">
                        <td className="max-w-xs truncate px-3 py-2 text-[var(--text-primary)]" title={c.campaign_name ?? ''}>
                          {c.campaign_name ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-tertiary)]">{objectiveLabel(c.objective)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{money2(c.spend)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{int(c.impressions)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{pct(c.ctr)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{money2(c.cpc)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{money2(c.cpm)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{num(c.frequency)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{int(c.results)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{money2(c.cost_per_result)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-quaternary)]">No campaign rows for this account.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
