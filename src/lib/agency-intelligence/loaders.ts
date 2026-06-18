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
import {
  computeAccountHealth,
  compareAccountHealth,
  type AccountHealth,
  type FathomSignalLite,
} from './insights/account-health';
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

// Row shape for `sl_fathom_signals` (not in the generated Supabase types yet).
export interface FathomSignalDbRow {
  id: string;
  client_slug: string;
  recording_id: string;
  signal_type: FathomSignalLite['signal_type'];
  severity: FathomSignalLite['severity'];
  quote: string;
  quote_sha256: string;
  speaker: string | null;
  call_date: string;
  extracted_at: string;
  source_metadata: Record<string, unknown>;
}

export interface SectionResult<T> {
  rows: T[];
  error: string | null;
}

/** Project a `sl_fathom_signals` DB row to the engine's `FathomSignalLite`. */
function toFathomSignalLite(
  row: FathomSignalDbRow,
  callType: string | null
): FathomSignalLite {
  const meta = row.source_metadata;
  const shareUrl =
    meta && typeof meta === 'object' && typeof meta.share_url === 'string'
      ? meta.share_url
      : null;
  return {
    signal_type: row.signal_type,
    severity: row.severity,
    quote: row.quote,
    speaker: row.speaker,
    call_date: row.call_date,
    recording_id: row.recording_id,
    call_type: callType,
    share_url: shareUrl,
  };
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
// Account-health cockpit — true-risk overview (spec §8.1).
// Selects all corpus clients + all Fathom signals in one pass, groups signals
// by client_slug, runs the deterministic engine per client, returns rows
// pre-sorted by (tierRank, score desc, lastSignalDate desc nulls last, slug).
// `sl_fathom_signals` is safeSelect-wrapped: a not-yet-provisioned table
// degrades to a verified-absent error string instead of crashing the page.
// ---------------------------------------------------------------------------

export interface AccountHealthOverview {
  /** AccountHealth rows pre-sorted true-risk desc (empty if corpus absent). */
  rows: AccountHealth[];
  /** Count of `tier === 'critical'` — the at-risk-dozen headline stat. */
  criticalCount: number;
  /** Non-fatal: corpus could not be read (rows is then empty). */
  corpusError: string | null;
  /**
   * Non-fatal: `sl_fathom_signals` not provisioned / unreadable. When set,
   * the engine still ran on corpus-only signals (empty fathom_signals) and
   * the UI should surface "Verbal signals: Not provisioned".
   */
  signalsError: string | null;
}

export async function getAccountHealthOverview(): Promise<AccountHealthOverview> {
  const supabase = await createClient();
  const generatedAt = new Date().toISOString();

  const [corpusClients, signals, transcriptTypes] = await Promise.all([
    safeSelect<CorpusClientCurrentRow>(() =>
      supabase
        .from('sl_corpus_clients_current')
        .select('*')
        .order('client_slug', { ascending: true })
    ),
    safeSelect<FathomSignalDbRow>(() =>
      supabase
        .from('sl_fathom_signals')
        .select('*')
        .order('call_date', { ascending: false })
    ),
    // call_type lives on the transcripts table; fetched separately so a failure
    // here can't hide signals — it only forgoes the sales-call tier exclusion.
    safeSelect<{ recording_id: string; call_type: string }>(() =>
      supabase.from('sl_fathom_transcripts').select('recording_id, call_type')
    ),
  ]);

  const callTypeByRecording = new Map<string, string>();
  for (const t of transcriptTypes.rows) {
    callTypeByRecording.set(t.recording_id, t.call_type);
  }

  // Group signals by client_slug (empty map if the table is absent).
  const signalsBySlug = new Map<string, FathomSignalLite[]>();
  for (const row of signals.rows) {
    const lite = toFathomSignalLite(row, callTypeByRecording.get(row.recording_id) ?? null);
    const bucket = signalsBySlug.get(row.client_slug);
    if (bucket) bucket.push(lite);
    else signalsBySlug.set(row.client_slug, [lite]);
  }

  const rows: AccountHealth[] = corpusClients.rows.map((c) =>
    computeAccountHealth({
      client_slug: c.client_slug,
      client_display_name: c.client_display_name,
      churn_score: c.churn_score,
      risk_tier: c.risk_tier,
      client_json: c.client_json,
      fathom_signals: signalsBySlug.get(c.client_slug) ?? [],
      generated_at: generatedAt,
    })
  );

  rows.sort(compareAccountHealth);

  return {
    rows,
    criticalCount: rows.reduce((n, r) => n + (r.tier === 'critical' ? 1 : 0), 0),
    corpusError: corpusClients.error,
    signalsError: signals.error,
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
  /** This client's verbal Fathom signals, newest call first (verified-absent on error). */
  fathomSignals: SectionResult<FathomSignalDbRow>;
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

  // 3b) verbal Fathom signals for slug, newest call first. safeSelect so a
  // not-yet-provisioned `sl_fathom_signals` table degrades to "Not provisioned".
  const fathomSignals = await safeSelect<FathomSignalDbRow>(() =>
    supabase
      .from('sl_fathom_signals')
      .select('*')
      .eq('client_slug', slug)
      .order('call_date', { ascending: false })
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
    fathomSignals,
    tracker,
    trackerErrors,
  };
}