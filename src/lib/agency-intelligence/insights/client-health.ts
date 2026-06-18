// Agency Intelligence Console — deterministic client-health insight.
// No LLM. Pure function: joins tracker truth (Supabase landing analytics) with corpus
// truth (SaaSLaunch snapshot) for one client and emits ONE evidence-backed AgencyInsight.
// Honest about absent events (zero-event sites are cited via the site row, not invented).

import {
  AgencyInsight,
  Evidence,
  Severity,
  corpusFileLocator,
  dbRowLocator,
  type AgencyInsight as AgencyInsightType,
} from '../contracts';

// ---------------------------------------------------------------------------
// Inputs — fetched upstream (UI route / loader). This module does no I/O.
// ---------------------------------------------------------------------------

export interface TrackerSiteTruth {
  site_slug: string;
  site_id: string; // uuid — so db_row locators resolve to agency_client_sites
  tracker_status: string; // planned | installed | verified | disabled | error
  event_count: number;
  last_event_at: string | null;
  rejection_count: number;
}

export interface TrackerTruth {
  client_slug: string;
  sites: TrackerSiteTruth[];
  total_events: number;
  total_rejections: number;
}

export interface CorpusTruth {
  client_slug: string;
  client_display_name: string | null;
  risk_tier: string | null;
  churn_score: number | null;
  gap_score: number | null;
  actions_count: number;
  promises_count: number;
  gaps_count: number;
  fathom_meetings_count: number;
  /** Relative path used for corpus_file locators, e.g. corpus/clients/checkle.json */
  corpus_file_path: string;
}

export interface ClientHealthInput {
  client_slug: string;
  tracker: TrackerTruth;
  corpus: CorpusTruth;
  refresh_run_id?: string | null;
  generated_at: string;
}

const INSTALLED_STATES = new Set(['installed', 'verified']);
const CHURN_HIGH_FLOOR = 5;

function siteEvidence(site: TrackerSiteTruth, generatedAt: string): Evidence[] {
  const ev: Evidence[] = [];
  const siteLocator = dbRowLocator('agency_client_sites', site.site_id);
  ev.push({
    kind: 'site_registry',
    locator: siteLocator,
    summary: `site ${site.site_slug}: tracker_status=${site.tracker_status}`,
    observed_at: generatedAt,
  });
  if (site.event_count > 0) {
    ev.push({
      kind: 'landing_event',
      locator: siteLocator,
      summary: `site ${site.site_slug}: ${site.event_count} landing_events${
        site.last_event_at ? `, last at ${site.last_event_at}` : ''
      }`,
      observed_at: generatedAt,
    });
  } else {
    // Honest absence: cite the site row and state zero rows observed. Do not invent a row id.
    ev.push({
      kind: 'landing_event',
      locator: siteLocator,
      summary: `site ${site.site_slug}: 0 landing_events rows observed (tracker_status=${site.tracker_status})`,
      observed_at: generatedAt,
    });
  }
  if (site.rejection_count > 0) {
    ev.push({
      kind: 'landing_rejection',
      locator: siteLocator,
      summary: `site ${site.site_slug}: ${site.rejection_count} rejected events`,
      observed_at: generatedAt,
    });
  }
  return ev;
}

function corpusEvidence(corpus: CorpusTruth, generatedAt: string): Evidence[] {
  const ev: Evidence[] = [];
  const fileLocator = corpusFileLocator(corpus.corpus_file_path);
  ev.push({
    kind: 'corpus_client',
    locator: fileLocator,
    summary: `risk tier=${corpus.risk_tier ?? 'n/a'}, churn_score=${
      corpus.churn_score ?? 'n/a'
    }, gap_score=${corpus.gap_score ?? 'n/a'}`,
    observed_at: generatedAt,
  });
  ev.push({
    kind: 'corpus_action',
    locator: corpusFileLocator(corpus.corpus_file_path, '/actions'),
    summary: `${corpus.actions_count} actions`,
    observed_at: generatedAt,
  });
  ev.push({
    kind: 'corpus_promise',
    locator: corpusFileLocator(corpus.corpus_file_path, '/promises'),
    summary: `${corpus.promises_count} promises`,
    observed_at: generatedAt,
  });
  ev.push({
    kind: 'corpus_gap',
    locator: corpusFileLocator(corpus.corpus_file_path, '/gaps'),
    summary: `${corpus.gaps_count} gaps`,
    observed_at: generatedAt,
  });
  ev.push({
    kind: 'corpus_call',
    locator: corpusFileLocator(corpus.corpus_file_path, '/fathom_meetings'),
    summary: `${corpus.fathom_meetings_count} fathom meetings`,
    observed_at: generatedAt,
  });
  return ev;
}

function deriveSeverity(
  installedNoEventCount: number,
  churnHigh: boolean,
  riskRed: boolean,
  hasEvents: boolean,
  hasSites: boolean
): Severity {
  if (installedNoEventCount > 0 && (churnHigh || riskRed)) return 'critical';
  if (installedNoEventCount > 0) return 'warning';
  if (churnHigh || riskRed) return 'warning';
  if (!hasSites) return 'info';
  if (!hasEvents) return 'info';
  return 'info';
}

function displayName(input: ClientHealthInput): string {
  return input.corpus.client_display_name ?? input.client_slug;
}

function buildHeadline(
  input: ClientHealthInput,
  severity: Severity,
  installedNoEventCount: number,
  churnHigh: boolean,
  riskRed: boolean
): string {
  const name = displayName(input);
  if (severity === 'critical') {
    return `${name}: tracker live but zero conversion events, and corpus flags at-risk`;
  }
  if (installedNoEventCount > 0) {
    return `${name}: tracker installed with zero conversion events on ${installedNoEventCount} site(s)`;
  }
  if (churnHigh || riskRed) {
    return `${name}: corpus flags at-risk (churn ${input.corpus.churn_score ?? 'n/a'}, tier ${
      input.corpus.risk_tier ?? 'n/a'
    })`;
  }
  if (input.tracker.sites.length === 0) {
    return `${name}: no tracker sites registered`;
  }
  return `${name}: tracker active with ${input.tracker.total_events} event(s); corpus risk ${
    input.corpus.risk_tier ?? 'n/a'
  }`;
}

function buildBody(input: ClientHealthInput, installedNoEvent: TrackerSiteTruth[]): string {
  const t = input.tracker;
  const c = input.corpus;
  const installedNames = installedNoEvent.map((s) => s.site_slug).join(', ');
  const trackerLine = `Tracker truth: ${t.sites.length} site(s), ${t.total_events} total event(s), ${t.total_rejections} rejection(s).${
    installedNoEvent.length > 0
      ? ` Sites with tracker installed but zero events: ${installedNames}.`
      : ''
  }`;
  const corpusLine = `Corpus truth: risk_tier=${c.risk_tier ?? 'n/a'}, churn_score=${
    c.churn_score ?? 'n/a'
  }, gap_score=${c.gap_score ?? 'n/a'}; ${c.actions_count} actions, ${c.promises_count} promises, ${c.gaps_count} gaps, ${c.fathom_meetings_count} fathom meetings.`;
  return `${trackerLine} ${corpusLine}`;
}

/**
 * Compute one deterministic, evidence-backed client_health insight. No LLM, no I/O.
 * The returned object is validated against the AgencyInsight contract.
 */
export function computeClientHealth(input: ClientHealthInput): AgencyInsightType {
  const { tracker, corpus, generated_at, client_slug, refresh_run_id } = input;

  const installedNoEvent = tracker.sites.filter(
    (s) => INSTALLED_STATES.has(s.tracker_status) && s.event_count === 0
  );
  const churnHigh = corpus.churn_score !== null && corpus.churn_score >= CHURN_HIGH_FLOOR;
  const riskRed = corpus.risk_tier === 'red';
  const hasEvents = tracker.total_events > 0;
  const hasSites = tracker.sites.length > 0;

  const severity = deriveSeverity(
    installedNoEvent.length,
    churnHigh,
    riskRed,
    hasEvents,
    hasSites
  );
  const headline = buildHeadline(input, severity, installedNoEvent.length, churnHigh, riskRed);
  const body = buildBody(input, installedNoEvent);

  const evidence: Evidence[] = [
    ...tracker.sites.flatMap((s) => siteEvidence(s, generated_at)),
    ...corpusEvidence(corpus, generated_at),
  ];

  const insight = {
    client_slug,
    insight_kind: 'client_health' as const,
    severity,
    headline,
    body,
    evidence,
    refresh_run_id: refresh_run_id ?? null,
    source_metadata: {
      tracker_total_events: tracker.total_events,
      tracker_total_rejections: tracker.total_rejections,
      corpus_churn_score: corpus.churn_score,
      corpus_risk_tier: corpus.risk_tier,
    },
    generated_at,
  };

  return AgencyInsight.parse(insight);
}