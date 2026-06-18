#!/usr/bin/env node
// scripts/zz-probe-agency-state.mjs
//
// READ-ONLY Agency Intelligence ground-truth probe.
// Reports: Supabase tracker truth (analytics subsystem) + local SaaSLaunch corpus truth
// + Checkle corpus sanity. Prints JSON plus a concise human summary.
//
// Hard contract:
//   - NEVER mutates DB or corpus files. Selects / reads only.
//   - If a table/column/file is missing, reports it as missing instead of crashing.
//   - Only a DB *connection* failure (bad URL/key/unreachable) is fatal.
//   - Never logs secret values. Only env var *presence* is reported.
//
// Usage: npm run agency:probe
// Overrides:
//   SAASLAUNCH_CORPUS_ROOT  (default /Users/ammar/Dev-Projects/saaslaunch)
//   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (else loaded from .env.local)

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

/** Minimal .env.local parser (no dotenv dependency). Returns a plain object. */
function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const env = loadEnvFile(path.join(REPO_ROOT, '.env.local'));

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';

const CORPUS_ROOT =
  process.env.SAASLAUNCH_CORPUS_ROOT ||
  env.SAASLAUNCH_CORPUS_ROOT ||
  '/Users/ammar/Dev-Projects/saaslaunch';

const ANALYTICS_TABLES = [
  'agency_clients',
  'agency_client_sites',
  'landing_event_definitions',
  'landing_event_property_definitions',
  'landing_events',
  'landing_event_rejections',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns { count, missing, error }. Never throws. */
async function countRows(supabase, table) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      return { count: null, missing: isMissingError(error), error: error.message };
    }
    return { count, missing: false, error: null };
  } catch (err) {
    return { count: null, missing: true, error: String(err?.message || err) };
  }
}

/** PostgREST/PG errors that indicate the relation or column does not exist. */
function isMissingError(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' || // undefined_table
    code === '42703' || // undefined_column
    msg.includes('does not exist') ||
    msg.includes('could not find the') ||
    msg.includes('relation') ||
    msg.includes('schema cache miss')
  );
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, missing: true, data: null };
  try {
    return { ok: true, missing: false, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (err) {
    return { ok: false, missing: false, error: String(err?.message || err), data: null };
  }
}

// ---------------------------------------------------------------------------
// DB section
// ---------------------------------------------------------------------------

async function probeDatabase() {
  const result = {
    connection: { url_present: Boolean(SUPABASE_URL), service_key_present: Boolean(SERVICE_KEY) },
    counts: {},
    journey_sessions_meeting_transcripts: null,
    per_site_truth: [],
    fatal_error: null,
  };

  if (!SUPABASE_URL || !SERVICE_KEY) {
    result.fatal_error =
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked process.env + .env.local).';
    return result;
  }

  let supabase;
  try {
    supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (err) {
    result.fatal_error = `Failed to construct Supabase client: ${err?.message || err}`;
    return result;
  }

  // 1) Per-table counts.
  for (const table of ANALYTICS_TABLES) {
    result.counts[table] = await countRows(supabase, table);
  }

  // 2) journey_sessions rows with non-empty meeting_transcripts (column may be missing).
  try {
    const { data, error } = await supabase
      .from('journey_sessions')
      .select('id, meeting_transcripts')
      .not('meeting_transcripts', 'is', null);
    if (error) {
      result.journey_sessions_meeting_transcripts = {
        column_exists: !isMissingError(error),
        missing: isMissingError(error),
        non_empty_count: null,
        error: error.message,
      };
    } else {
      // meeting_transcripts is a jsonb array; "non-empty" = array length > 0.
      let nonEmpty = 0;
      for (const row of data || []) {
        const mt = row.meeting_transcripts;
        if (Array.isArray(mt) && mt.length > 0) nonEmpty++;
        else if (mt && typeof mt === 'object' && !Array.isArray(mt) && Object.keys(mt).length > 0)
          nonEmpty++;
      }
      result.journey_sessions_meeting_transcripts = {
        column_exists: true,
        missing: false,
        non_empty_count: nonEmpty,
        rows_with_any_value: (data || []).length,
        error: null,
      };
    }
  } catch (err) {
    result.journey_sessions_meeting_transcripts = {
      column_exists: false,
      missing: true,
      non_empty_count: null,
      error: String(err?.message || err),
    };
  }

  // 3) Per-client / per-site tracker truth.
  //    Sites carry tracker_status + tracker_last_seen_at. landing_events is keyed by
  //    site_id (FK); landing_event_rejections is keyed by client_slug + site_slug (strings).
  let sites = null;
  let sitesError = null;
  try {
    const res = await supabase
      .from('agency_client_sites')
      .select(
        'id, slug, tracker_status, tracker_last_seen_at, client_id, client:client_id(slug, display_name)'
      );
    sites = res.data;
    sitesError = res.error;
  } catch (err) {
    sitesError = err;
  }

  if (sitesError) {
    result.per_site_truth = {
      missing: isMissingError(sitesError),
      error: sitesError?.message || String(sitesError),
    };
  } else if (sites) {
    for (const site of sites) {
      const clientSlug = site.client?.slug ?? null;
      const clientDisplayName = site.client?.display_name ?? null;

      const ev = await countRows(supabase, 'landing_events').then(async (c) => {
        // countRows counts ALL events; we need per-site. Do a headed count filtered by site.
        if (c.missing) return { count: null, missing: true, error: c.error };
        const { count, error } = await supabase
          .from('landing_events')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', site.id);
        return {
          count: error ? null : count,
          missing: error ? isMissingError(error) : false,
          error: error ? error.message : null,
        };
      });

      // Last event timestamp for this site.
      let lastEventAt = null;
      if (!ev.missing) {
        const { data: lastEv, error: lastErr } = await supabase
          .from('landing_events')
          .select('occurred_at')
          .eq('site_id', site.id)
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!lastErr && lastEv) lastEventAt = lastEv.occurred_at;
      }

      // Rejection count for this client_slug + site_slug.
      let rej = { count: null, missing: false, error: null };
      const rejTable = await countRows(supabase, 'landing_event_rejections');
      if (rejTable.missing) {
        rej = { count: null, missing: true, error: rejTable.error };
      } else if (clientSlug) {
        const { count, error } = await supabase
          .from('landing_event_rejections')
          .select('*', { count: 'exact', head: true })
          .eq('client_slug', clientSlug)
          .eq('site_slug', site.slug);
        rej = {
          count: error ? null : count,
          missing: error ? isMissingError(error) : false,
          error: error ? error.message : null,
        };
      }

      result.per_site_truth.push({
        client_slug: clientSlug,
        client_display_name: clientDisplayName,
        site_slug: site.slug,
        tracker_status: site.tracker_status ?? null,
        tracker_last_seen_at: site.tracker_last_seen_at ?? null,
        landing_event_count: ev.count,
        rejection_count: rej.count,
        last_event_occurred_at: lastEventAt,
        errors: {
          landing_events: ev.error,
          rejections: rej.error,
        },
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Corpus section
// ---------------------------------------------------------------------------

function probeCorpus() {
  const root = CORPUS_ROOT;
  const out = {
    corpus_root: root,
    exists: fs.existsSync(root),
    index: null,
    manifest: null,
    clients_dir: null,
    fathom_meetings_coverage: null,
    checkle: null,
  };
  if (!out.exists) return out;

  // index.json
  const idx = safeReadJson(path.join(root, 'corpus', 'index.json'));
  if (idx.ok) {
    const clients = Array.isArray(idx.data?.clients) ? idx.data.clients : [];
    out.index = {
      exists: true,
      client_count: clients.length,
      clients: clients.map((c) => ({
        slug: c.slug ?? c.client_id ?? null,
        client: c.client ?? null,
        risk_tier: c.risk_tier ?? null,
        churn_score: c.churn_score ?? null,
        gap_score: c.gap_score ?? null,
        sources_total: c.sources_total ?? null,
        source_counts: c.source_counts ?? null,
      })),
    };
  } else {
    out.index = { exists: !idx.missing, missing: idx.missing, error: idx.error || null };
  }

  // _manifest.json
  const man = safeReadJson(path.join(root, 'corpus', '_manifest.json'));
  if (man.ok) {
    out.manifest = {
      exists: true,
      client_count: man.data?.client_count ?? null,
      clients: Array.isArray(man.data?.clients) ? man.data.clients : null,
    };
  } else {
    out.manifest = { exists: !man.missing, missing: man.missing, error: man.error || null };
  }

  // corpus/clients/*.json
  const clientsDir = path.join(root, 'corpus', 'clients');
  let clientFiles = [];
  if (fs.existsSync(clientsDir)) {
    clientFiles = fs
      .readdirSync(clientsDir)
      .filter((f) => f.endsWith('.json'));
  }
  out.clients_dir = {
    exists: fs.existsSync(clientsDir),
    file_count: clientFiles.length,
  };

  // fathom_meetings coverage across all client files
  const coverage = { total: clientFiles.length, with_fathom_meetings: 0, missing_in: [] };
  for (const f of clientFiles) {
    const j = safeReadJson(path.join(clientsDir, f));
    if (j.ok && j.data && 'fathom_meetings' in j.data) {
      coverage.with_fathom_meetings += 1;
    } else {
      coverage.missing_in.push(f.replace(/\.json$/, ''));
    }
  }
  out.fathom_meetings_coverage = coverage;

  // Checkle sanity
  const checklePath = path.join(clientsDir, 'checkle.json');
  const ck = safeReadJson(checklePath);
  if (ck.ok && ck.data) {
    const d = ck.data;
    const indexEntry = out.index?.clients?.find((c) => c.slug === 'checkle') || null;
    out.checkle = {
      exists: true,
      source_counts: indexEntry?.source_counts ?? d.provenance ?? null,
      risk_tier: d.risk?.tier ?? indexEntry?.risk_tier ?? null,
      churn_score: d.risk?.churn_score ?? indexEntry?.churn_score ?? null,
      gap_score: d.risk?.gap_score ?? indexEntry?.gap_score ?? null,
      actions_count: Array.isArray(d.actions) ? d.actions.length : null,
      promises_count: Array.isArray(d.promises) ? d.promises.length : null,
      gaps_count: Array.isArray(d.gaps) ? d.gaps.length : null,
      fathom_meetings_count: Array.isArray(d.fathom_meetings) ? d.fathom_meetings.length : null,
    };
  } else {
    out.checkle = { exists: !ck.missing, missing: ck.missing, error: ck.error || null };
  }

  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startedAt = new Date().toISOString();
  const database = await probeDatabase();
  const corpus = probeCorpus();

  const report = {
    probe: 'zz-probe-agency-state',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    repo_root: REPO_ROOT,
    corpus_root: CORPUS_ROOT,
    database,
    corpus,
  };

  // Full JSON to stdout.
  console.log(JSON.stringify(report, null, 2));

  // Concise human summary to stderr (so JSON stays parseable on stdout).
  const lines = [];
  lines.push('=== Agency Intelligence — ground-truth summary ===');
  lines.push(`repo: ${REPO_ROOT}`);
  lines.push(`corpus root: ${CORPUS_ROOT} (exists=${corpus.exists})`);

  if (database.fatal_error) {
    lines.push(`DB: FATAL ${database.fatal_error}`);
  } else {
    lines.push(`DB: url=${database.connection.url_present} key=${database.connection.service_key_present}`);
    for (const [t, r] of Object.entries(database.counts)) {
      const tag = r.missing ? 'MISSING' : r.error ? 'ERROR' : String(r.count);
      lines.push(`  ${t}: ${tag}${r.error && !r.missing ? ` (${r.error})` : ''}`);
    }
    const mt = database.journey_sessions_meeting_transcripts;
    if (mt) {
      if (mt.missing) lines.push(`  journey_sessions.meeting_transcripts: MISSING (${mt.error})`);
      else
        lines.push(
          `  journey_sessions.meeting_transcripts: column_exists=${mt.column_exists} non_empty_count=${mt.non_empty_count}`
        );
    }
    if (Array.isArray(database.per_site_truth)) {
      lines.push(`  per-site truth: ${database.per_site_truth.length} site(s)`);
      for (const s of database.per_site_truth) {
        lines.push(
          `    - ${s.client_slug}/${s.site_slug} tracker=${s.tracker_status} last_seen=${s.tracker_last_seen_at} events=${s.landing_event_count} rejections=${s.rejection_count} last_event=${s.last_event_occurred_at}`
        );
      }
    } else if (database.per_site_truth?.missing) {
      lines.push(`  per-site truth: MISSING (${database.per_site_truth.error})`);
    }
  }

  if (corpus.exists) {
    lines.push(
      `corpus: index client_count=${corpus.index?.client_count ?? 'n/a'} manifest client_count=${corpus.manifest?.client_count ?? 'n/a'} clients_dir files=${corpus.clients_dir?.file_count ?? 'n/a'}`
    );
    const cov = corpus.fathom_meetings_coverage;
    if (cov)
      lines.push(
        `  fathom_meetings coverage: ${cov.with_fathom_meetings}/${cov.total}${cov.missing_in.length ? ` missing_in=[${cov.missing_in.join(',')}]` : ''}`
      );
    const ck = corpus.checkle;
    if (ck?.exists) {
      lines.push(
        `  Checkle: risk=${ck.risk_tier} churn=${ck.churn_score} gap=${ck.gap_score} actions=${ck.actions_count} promises=${ck.promises_count} gaps=${ck.gaps_count} fathom_meetings=${ck.fathom_meetings_count}`
      );
    } else {
      lines.push(`  Checkle: missing`);
    }
  }

  console.error(lines.join('\n'));
}

main().catch((err) => {
  console.error('PROBE FATAL:', err?.stack || err);
  process.exit(1);
});