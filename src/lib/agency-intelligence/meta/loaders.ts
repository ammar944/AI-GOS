// Meta Ads Account Dashboard — server data loaders.
// Reads sl_meta_* from Supabase via the Clerk-aware client (RLS: internal users
// select). Tables are safeSelect-wrapped so a not-yet-provisioned table surfaces
// as a verified-absent error string instead of crashing the page. No LLM.

import { createClient } from '@/lib/supabase/server';
import {
  computeMetaSignals,
  type MetaSignalsSummary,
  type DailyCtrPoint,
} from './signals';

const WINDOW_DAYS = 30;

export interface MetaAccountRow {
  meta_account_id: string;
  client_slug: string;
  account_name: string | null;
  currency: string | null;
  status: string | null;
  is_mcp_enabled: boolean;
  connected_at: string;
}

export interface MetaInsightRow {
  meta_account_id: string;
  date: string;
  level: 'account' | 'campaign';
  campaign_id: string | null;
  campaign_name: string | null;
  objective: string | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  link_clicks: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  cost_per_result: number | null;
  purchase_value: number | null;
  roas: number | null;
  currency: string | null;
}

interface DbError {
  message: string;
}

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null; error: DbError | null }>
): Promise<{ rows: T[]; error: string | null }> {
  try {
    const { data, error } = await run();
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as unknown as T[], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// Sum skipping nulls; null only if every value is null.
function sumOrNull(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((n, v) => n + v, 0);
}

function avgOrNull(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((n, v) => n + v, 0) / present.length;
}

// PostgREST returns `numeric` columns as strings (precision preservation), so
// every numeric field is coerced to a real number | null before any math.
const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function mapInsight(r: MetaInsightRow): MetaInsightRow {
  return {
    ...r,
    spend: toNum(r.spend),
    impressions: toNum(r.impressions),
    reach: toNum(r.reach),
    frequency: toNum(r.frequency),
    link_clicks: toNum(r.link_clicks),
    clicks: toNum(r.clicks),
    ctr: toNum(r.ctr),
    cpc: toNum(r.cpc),
    cpm: toNum(r.cpm),
    results: toNum(r.results),
    cost_per_result: toNum(r.cost_per_result),
    purchase_value: toNum(r.purchase_value),
    roas: toNum(r.roas),
  };
}

export interface MetaKpis {
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  linkClicks: number | null;
  frequency: number | null;
  // Derived from sums (not daily-ratio averages).
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  costPerResult: number | null;
  roas: number | null;
  days: number;
}

// Aggregate account-level daily rows into window KPIs. CTR/CPC/CPM are derived
// from the summed spend/impressions/clicks (correct weighting), not by averaging
// each day's ratio.
function aggregateKpis(rows: MetaInsightRow[]): MetaKpis {
  const spend = sumOrNull(rows.map((r) => r.spend));
  const impressions = sumOrNull(rows.map((r) => r.impressions));
  const reach = sumOrNull(rows.map((r) => r.reach));
  const clicks = sumOrNull(rows.map((r) => r.clicks));
  const linkClicks = sumOrNull(rows.map((r) => r.link_clicks));
  const results = sumOrNull(rows.map((r) => r.results));
  return {
    spend,
    impressions,
    reach,
    clicks,
    linkClicks,
    frequency: avgOrNull(rows.map((r) => r.frequency)),
    ctr: impressions && impressions > 0 && clicks != null ? (clicks / impressions) * 100 : null,
    cpc: clicks && clicks > 0 && spend != null ? spend / clicks : null,
    cpm: impressions && impressions > 0 && spend != null ? (spend / impressions) * 1000 : null,
    results,
    costPerResult: results && results > 0 && spend != null ? spend / results : null,
    roas: sumOrNull(rows.map((r) => r.roas)) != null ? avgOrNull(rows.map((r) => r.roas)) : null,
    days: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Portfolio overview
// ---------------------------------------------------------------------------
export interface MetaAccountSummary {
  account: MetaAccountRow;
  kpis: MetaKpis | null; // null when pending / no insights
}

export interface MetaAdsOverview {
  accounts: MetaAccountSummary[];
  accountsError: string | null;
  insightsError: string | null;
  portfolio: {
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    cpc: number | null;
    activeClients: number;
    pendingClients: number;
  };
}

export async function getMetaAdsOverview(): Promise<MetaAdsOverview> {
  const supabase = await createClient();

  const accountsRes = await safeSelect<MetaAccountRow>(() =>
    supabase.from('sl_meta_ad_accounts').select('*').order('client_slug', { ascending: true })
  );

  const insightsRes = await safeSelect<MetaInsightRow>(() =>
    supabase
      .from('sl_meta_insights')
      .select('*')
      .eq('level', 'account')
      .order('date', { ascending: false })
  );

  // Group account-level rows by account, keep the most recent WINDOW_DAYS.
  const byAccount = new Map<string, MetaInsightRow[]>();
  for (const r of insightsRes.rows.map(mapInsight)) {
    const bucket = byAccount.get(r.meta_account_id);
    if (bucket) bucket.push(r);
    else byAccount.set(r.meta_account_id, [r]);
  }

  const accounts: MetaAccountSummary[] = accountsRes.rows.map((account) => {
    const rows = (byAccount.get(account.meta_account_id) ?? []).slice(0, WINDOW_DAYS);
    return { account, kpis: rows.length > 0 ? aggregateKpis(rows) : null };
  });

  const withKpis = accounts.filter((a) => a.kpis);
  const portfolio = {
    spend: sumOrNull(withKpis.map((a) => a.kpis!.spend)),
    impressions: sumOrNull(withKpis.map((a) => a.kpis!.impressions)),
    clicks: sumOrNull(withKpis.map((a) => a.kpis!.clicks)),
    ctr: null as number | null,
    cpc: null as number | null,
    activeClients: withKpis.length,
    pendingClients: accounts.length - withKpis.length,
  };
  if (portfolio.impressions && portfolio.impressions > 0 && portfolio.clicks != null) {
    portfolio.ctr = (portfolio.clicks / portfolio.impressions) * 100;
  }
  if (portfolio.clicks && portfolio.clicks > 0 && portfolio.spend != null) {
    portfolio.cpc = portfolio.spend / portfolio.clicks;
  }

  return {
    accounts,
    accountsError: accountsRes.error,
    insightsError: insightsRes.error,
    portfolio,
  };
}

// ---------------------------------------------------------------------------
// Account detail
// ---------------------------------------------------------------------------
export interface MetaTrendPoint {
  date: string;
  spend: number | null;
  ctr: number | null;
  cpc: number | null;
}

export interface MetaAccountDetail {
  account: MetaAccountRow | null;
  notFound: boolean;
  error: string | null;
  kpis: MetaKpis | null;
  trend: MetaTrendPoint[];
  campaigns: MetaInsightRow[];
  signals: MetaSignalsSummary | null;
}

export async function getMetaAccountDetail(slug: string): Promise<MetaAccountDetail> {
  const supabase = await createClient();

  const accountRes = await safeSelect<MetaAccountRow>(() =>
    supabase.from('sl_meta_ad_accounts').select('*').eq('client_slug', slug).limit(1)
  );
  const account = accountRes.rows[0] ?? null;
  if (!account) {
    return {
      account: null,
      notFound: accountRes.error == null,
      error: accountRes.error,
      kpis: null,
      trend: [],
      campaigns: [],
      signals: null,
    };
  }

  const insightsRes = await safeSelect<MetaInsightRow>(() =>
    supabase
      .from('sl_meta_insights')
      .select('*')
      .eq('meta_account_id', account.meta_account_id)
      .order('date', { ascending: true })
  );

  const mapped = insightsRes.rows.map(mapInsight);
  const accountDaily = mapped
    .filter((r) => r.level === 'account')
    .sort((a, b) => a.date.localeCompare(b.date));
  const campaigns = mapped
    .filter((r) => r.level === 'campaign')
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));

  const windowRows = accountDaily.slice(-WINDOW_DAYS);
  const kpis = windowRows.length > 0 ? aggregateKpis(windowRows) : null;

  const trend: MetaTrendPoint[] = windowRows.map((r) => ({
    date: r.date,
    spend: r.spend,
    ctr: r.ctr,
    cpc: r.cpc,
  }));

  const ctrSeries: DailyCtrPoint[] = windowRows.map((r) => ({ date: r.date, ctr: r.ctr }));
  const signals =
    kpis != null
      ? computeMetaSignals({
          frequency: kpis.frequency,
          ctr: kpis.ctr,
          cpc: kpis.cpc,
          cpm: kpis.cpm,
          objective: null, // account-level: blended benchmark
          ctrSeries,
        })
      : null;

  return {
    account,
    notFound: false,
    error: insightsRes.error,
    kpis,
    trend,
    campaigns,
    signals,
  };
}
