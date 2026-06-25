import type React from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { getMetaAdsOverview } from '@/lib/agency-intelligence/meta/loaders';

export const dynamic = 'force-dynamic';

const dash = (s: string | number | null | undefined): string =>
  s == null || s === '' ? '—' : String(s);
const money = (n: number | null): string =>
  n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`;
const money2 = (n: number | null): string => (n == null ? '—' : `$${n.toFixed(2)}`);
const int = (n: number | null): string => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const pct = (n: number | null): string => (n == null ? '—' : `${n.toFixed(2)}%`);
const num = (n: number | null, d = 2): string => (n == null ? '—' : n.toFixed(d));

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

export default async function MetaAdsPage(): Promise<React.JSX.Element> {
  const overview = await getMetaAdsOverview();
  const { portfolio, accounts, accountsError } = overview;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-8 py-10">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
              Meta Ads
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--text-tertiary)]">
              Read-only performance for SaaSLaunch clients&rsquo; own Meta (Facebook + Instagram) ad
              accounts. KPIs reflect the last 30 days of account-level daily data; metrics Meta does
              not track for a given objective render as &ldquo;—&rdquo;.
            </p>
          </div>

          {/* Portfolio stat blocks */}
          <div className="grid gap-6 border-y border-[var(--border-default)] py-5 sm:grid-cols-3 lg:grid-cols-6">
            <StatBlock label="Spend (30d)" value={money(portfolio.spend)} hint="account-level, all clients" />
            <StatBlock label="Impressions" value={int(portfolio.impressions)} hint="last 30 days" />
            <StatBlock label="Clicks (all)" value={int(portfolio.clicks)} hint="last 30 days" />
            <StatBlock label="CTR (all)" value={pct(portfolio.ctr)} hint="clicks ÷ impressions" />
            <StatBlock label="Active clients" value={portfolio.activeClients} hint="MCP-enabled, pulling" />
            <StatBlock label="Pending" value={portfolio.pendingClients} hint="awaiting Meta MCP rollout" />
          </div>

          {/* Per-client table */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Clients ({accounts.length})
            </h2>
            {accounts.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-hover)] text-[11px] uppercase tracking-wide text-[var(--text-quaternary)]">
                    <tr>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Spend (30d)</th>
                      <th className="px-3 py-2 text-right">Impressions</th>
                      <th className="px-3 py-2 text-right">Clicks</th>
                      <th className="px-3 py-2 text-right">CTR</th>
                      <th className="px-3 py-2 text-right">CPC</th>
                      <th className="px-3 py-2 text-right">Freq.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {accounts.map(({ account, kpis }) => {
                      const pending = kpis == null;
                      return (
                        <tr key={account.meta_account_id} className="align-top hover:bg-[var(--bg-hover)]">
                          <td className="px-3 py-2">
                            {pending ? (
                              <span className="font-medium text-[var(--text-secondary)]">
                                {dash(account.account_name ?? account.client_slug)}
                              </span>
                            ) : (
                              <Link
                                href={`/internal/meta-ads/${account.client_slug}`}
                                className="font-medium text-[var(--text-primary)] hover:underline"
                              >
                                {dash(account.account_name ?? account.client_slug)}
                              </Link>
                            )}
                            <span className="ml-2 text-[11px] text-[var(--text-quaternary)]">
                              {account.client_slug}
                            </span>
                          </td>
                          {pending ? (
                            <td colSpan={7} className="px-3 py-2">
                              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                                pending Meta MCP rollout
                              </span>
                            </td>
                          ) : (
                            <>
                              <td className="px-3 py-2">
                                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                                  {dash(account.status ?? 'active')}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">{money2(kpis.spend)}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">{int(kpis.impressions)}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">{int(kpis.clicks)}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">{pct(kpis.ctr)}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">{money2(kpis.cpc)}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">{num(kpis.frequency)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-amber-300">
                {accountsError ? (
                  <>Not provisioned: <span className="font-mono">{accountsError}</span></>
                ) : (
                  'No Meta ad accounts synced yet. Stage a pull and run `npm run meta:sync`.'
                )}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
