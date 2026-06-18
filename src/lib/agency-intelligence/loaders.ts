// Agency Intelligence Console — server data loaders.
// Reads tracker truth (landing analytics) + corpus truth (sl_corpus_* snapshots) from
// Supabase using the Clerk-aware client (RLS: internal users select). Every section is
// wrapped so a not-yet-provisioned table surfaces as a verified-absent error string
// instead of crashing the page. No `any`; explicit row interfaces.

import { createClient } from '@/lib/supabase/server';
import {
  computeClientHealth,
  type ClientHealthInput,
  type TrackerSiteTruth,
  type TrackerTruth,
  type CorpusTruth,
} from './insights/client-health';
import type { AgencyInsight as AgencyInsightType } from './contracts';

// ---------------------------------------------------------------------------
// Row interfaces (the sl_* tables are not in the generated Supabase types yet).
// ---------------------------------------------------------------------------

export interface CorpusClientCurrentRow {
  client_slug: string;
  client_display_name: string | null;
  latest_refresh_run_id: string | null;
  latest_snapshot_id: string | null;
  manifest_hash: string;
  risk_tier: string | null;
  churn_score: number | null;
  gap_score: number | null;
  sources_total: number | null;
  source_counts: Record<string, number>;
  actions_count: number;
  promises_count: number;
  gaps_count: number;
  fathom_meetings_count: number;
  client_json: Record<string, unknown>;
  captured_at: string;
  updated_at: string;
}

export interface RefreshRunRow {
  id: string;
  run_kind: string;
  status: string;
  dry_run: boolean;
  manifest_hash: string;
  client_count: number;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

export interface InsightRow {
  id: string;
  client_slug: string;
  insight_kind: string;
  severity: string;
  headline: string;
  body: string;
  evidence: AgencyInsightType['evidence'];
  refresh_run_id: string | null;
  generated_at: string;
}

export interface SectionResult<T> {
  rows: T[];
  error: string | null;
}

interface DbError {
  message: string;
  code?: string;
}

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null; error: DbError | null }>
): Promise<SectionResult<T>> {
  try {
    const { data, error } = await run();
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as unknown as T[], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function safeMaybeSingle<T>(
  run: () => PromiseLike<{ data: T | null; error: DbError | null }>
): Promise<{ row: T | null; error: string | null }> {
  try {
    const { data, error } = await run();
    if (error) return { row: null, error: error.message };
    return { row: (data ?? null) as unknown as T | null, error: null };
  } catch (e) {
    return { row: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function safeCount(
  run: () => PromiseLike<{ count: number | null; error: DbError | null }>
): Promise<{ count: number | null; error: string | null }> {
  try {
    const { count, error } = await run();
    if (error) return { count: null, error: error.message };
    return { count: count ?? 0, error: null };
  } catch (e) {
    return { count: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface AgencyOverview {
  corpusClients: SectionResult<CorpusClientCurrentRow>;
  latestRun: SectionResult<RefreshRunRow>;
  latestInsight: SectionResult<InsightRow>;
  trackerTotals: {
    clients: number | null;
    sites: number | null;
    events: number | null;
    errors: string[];
  };
}

export async function getAgencyOverview(): Promise<AgencyOverview> {
  const supabase = await createClient();

  const corpusClients = await safeSelect<CorpusClientCurrentRow>(() =>
    supabase
      .from('sl_corpus_clients_current')
      .select('*')
      .order('client_slug', { ascending: true })
  );

  const latestRun = await safeSelect<RefreshRunRow>(() =>
    supabase
      .from('sl_refresh_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
  );

  const latestInsight = await safeSelect<InsightRow>(() =>
    supabase
      .from('sl_insights')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
  );

  const [clients, sites, events] = await Promise.all([
    safeCount(() =>
      supabase.from('agency_clients').select('*', { count: 'exact', head: true })
    ),
    safeCount(() =>
      supabase.from('agency_client_sites').select('*', { count: 'exact', head: true })
    ),
    safeCount(() =>
      supabase.from('landing_events').select('*', { count: 'exact', head: true })
    ),
  ]);

  const errors = [clients.error, sites.error, events.error].filter(
    (e): e is string => e !== null
  );

  return {
    corpusClients,
    latestRun,
    latestInsight,
    trackerTotals: {
      clients: clients.count,
      sites: sites.count,
      events: events.count,
      errors,
    },
  };
}

// ---------------------------------------------------------------------------
// Client detail — assembles tracker + corpus truth, computes the live insight.
// ---------------------------------------------------------------------------

interface AgencyClientRow {
  id: string;
  slug: string;
  display_name: string | null;
}

interface AgencyClientSiteRow {
  id: string;
  slug: string;
  tracker_status: string;
  tracker_last_seen_at: string | null;
}

interface LandingEventRow {
  site_id: string | null;
  occurred_at: string;
}

interface LandingRejectionRow {
  site_slug: string | null;
  event_key: string | null;
  reason: string | null;
}

export interface ClientDetail {
  slug: string;
  clientRow: { row: AgencyClientRow | null; error: string | null };
  corpus: { row: CorpusClientCurrentRow | null; error: string | null };
  insight: { insight: AgencyInsightType | null; error: string | null };
  persistedInsights: SectionResult<InsightRow>;
  tracker: TrackerTruth;
  trackerErrors: string[];
}

export async function getClientDetail(slug: string): Promise<ClientDetail> {
  const supabase = await createClient();

  // 1) agency client by slug
  const clientRow = await safeMaybeSingle<AgencyClientRow>(() =>
    supabase
      .from('agency_clients')
      .select('id, slug, display_name')
      .eq('slug', slug)
      .maybeSingle()
  );

  // 2) corpus current for slug
  const corpus = await safeMaybeSingle<CorpusClientCurrentRow>(() =>
    supabase
      .from('sl_corpus_clients_current')
      .select('*')
      .eq('client_slug', slug)
      .maybeSingle()
  );

  // 3) persisted insight history for slug
  const persistedInsights = await safeSelect<InsightRow>(() =>
    supabase
      .from('sl_insights')
      .select('*')
      .eq('client_slug', slug)
      .order('generated_at', { ascending: false })
      .limit(5)
  );

  // 4) tracker truth — only meaningful if we resolved the client id.
  const trackerErrors: string[] = [];
  let tracker: TrackerTruth = { client_slug: slug, sites: [], total_events: 0, total_rejections: 0 };

  if (clientRow.row?.id) {
    const clientId = clientRow.row.id;

    const sitesRes = await safeSelect<AgencyClientSiteRow>(() =>
      supabase
        .from('agency_client_sites')
        .select('id, slug, tracker_status, tracker_last_seen_at')
        .eq('client_id', clientId)
        .order('slug', { ascending: true })
    );
    if (sitesRes.error) trackerErrors.push(sitesRes.error);

    const eventsRes = await safeSelect<LandingEventRow>(() =>
      supabase
        .from('landing_events')
        .select('site_id, occurred_at')
        .eq('client_id', clientId)
    );
    if (eventsRes.error) trackerErrors.push(eventsRes.error);

    const rejectionsRes = await safeSelect<LandingRejectionRow>(() =>
      supabase
        .from('landing_event_rejections')
        .select('site_slug, event_key, reason')
        .eq('client_slug', slug)
    );
    if (rejectionsRes.error) trackerErrors.push(rejectionsRes.error);

    if (!sitesRes.error && !eventsRes.error && !rejectionsRes.error) {
      const eventsBySite = new Map<string, { count: number; last: string | null }>();
      for (const ev of eventsRes.rows) {
        const key = ev.site_id ?? '__null__';
        const cur = eventsBySite.get(key) ?? { count: 0, last: null };
        cur.count += 1;
        if (!cur.last || ev.occurred_at > cur.last) cur.last = ev.occurred_at;
        eventsBySite.set(key, cur);
      }
      const rejectionsBySite = new Map<string, number>();
      for (const r of rejectionsRes.rows) {
        const key = r.site_slug ?? '__null__';
        rejectionsBySite.set(key, (rejectionsBySite.get(key) ?? 0) + 1);
      }

      const siteTruths: TrackerSiteTruth[] = sitesRes.rows.map((s) => {
        const ev = eventsBySite.get(s.id) ?? { count: 0, last: null };
        const rej = rejectionsBySite.get(s.slug) ?? 0;
        return {
          site_slug: s.slug,
          site_id: s.id,
          tracker_status: s.tracker_status,
          event_count: ev.count,
          last_event_at: ev.last,
          rejection_count: rej,
        };
      });
      const total_events = siteTruths.reduce((a, s) => a + s.event_count, 0);
      const total_rejections = siteTruths.reduce((a, s) => a + s.rejection_count, 0);
      tracker = { client_slug: slug, sites: siteTruths, total_events, total_rejections };
    }
  }

  // 5) compute the live insight if we have corpus truth (tracker may be empty/absent).
  let insight: AgencyInsightType | null = null;
  let insightError: string | null = null;
  if (corpus.row) {
    const c = corpus.row;
    const corpusTruth: CorpusTruth = {
      client_slug: c.client_slug,
      client_display_name: c.client_display_name,
      risk_tier: c.risk_tier,
      churn_score: c.churn_score,
      gap_score: c.gap_score,
      actions_count: c.actions_count,
      promises_count: c.promises_count,
      gaps_count: c.gaps_count,
      fathom_meetings_count: c.fathom_meetings_count,
      corpus_file_path: `corpus/clients/${c.client_slug}.json`,
    };
    const healthInput: ClientHealthInput = {
      client_slug: slug,
      tracker,
      corpus: corpusTruth,
      refresh_run_id: c.latest_refresh_run_id,
      generated_at: new Date().toISOString(),
    };
    try {
      insight = computeClientHealth(healthInput);
    } catch (e) {
      insightError = e instanceof Error ? e.message : String(e);
    }
  } else if (corpus.error) {
    insightError = corpus.error;
  }

  return {
    slug,
    clientRow,
    corpus,
    insight: { insight, error: insightError },
    persistedInsights,
    tracker,
    trackerErrors,
  };
}