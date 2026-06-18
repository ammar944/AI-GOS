#!/usr/bin/env node
// Account-Health Cockpit — Fathom raw-sync pipeline (spec §5).
//
// Deterministic ONLY. Builds the attribution map from the corpus fathom_meetings
// index (normalizing recording_id to String() on BOTH sides) and syncs raw
// transcripts into sl_fathom_transcripts. There is NO metered LLM step here:
// signal extraction is offline (local Claude agents stage a JSON file; a
// deterministic uploader validates + upserts it). See the redirect below.
//
// Usage:
//   npm run agency:sync-fathom                       # raw sync (writes to Supabase)
//   npm run agency:sync-fathom -- --dry-run          # plan only — NO DB, NO creds
//   npm run agency:sync-fathom -- --list-attributed  # work-list JSON of attributed calls (NO DB, NO creds)
//   npm run agency:sync-fathom -- --force            # re-write even if raw_sha256 unchanged
//   SAASLAUNCH_REPO=/path npm run agency:sync-fathom -- --dry-run
//
//   # Signal extraction moved offline (no metered API from this script):
//   #   /agency-extract-signals   (local agents stage JSON)
//   #   npm run agency:upload-signals  (deterministic gate + upsert)
//
// Guards (fail closed, zero partial writes):
//   1. intake/fathom/meetings has >=1 *.json file.
//   2. corpus/index.json + corpus/clients/*.json parse.
//   3. each Fathom file parses with recording_id + transcript[].
//   4. attribution map: a recording_id mapping to >1 slug FAILS the guard (zero writes).
//
// --dry-run and --list-attributed never touch the DB and never need creds.

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './_fathom-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const ARGV = process.argv.slice(2);
const DRY_RUN = ARGV.includes('--dry-run');
const FORCE = ARGV.includes('--force');
const LIST_ATTRIBUTED = ARGV.includes('--list-attributed'); // work-list JSON, no DB/creds
// Optional --client=<slug> to scope --list-attributed to one client (the
// "eyeball one client before the full sweep" gate in /agency-extract-signals).
const CLIENT_FILTER = (() => {
  const flag = ARGV.find((a) => a.startsWith('--client='));
  return flag ? flag.slice('--client='.length).trim() || null : null;
})();
// Signal extraction is now offline (see redirect below). These flags are kept
// only to print a one-line redirect and exit 0 — never to call any API.
const EXTRACT_REDIRECT_FLAGS = ['--extract', '--extract-only', '--signals-only'];
const EXTRACT_REQUESTED = ARGV.some((a) => EXTRACT_REDIRECT_FLAGS.includes(a));

const SAASLAUNCH_REPO =
  process.env.SAASLAUNCH_REPO || '/Users/ammar/Dev-Projects/saaslaunch';

const CORPUS_DIR = path.join(SAASLAUNCH_REPO, 'corpus');
const INDEX_PATH = path.join(CORPUS_DIR, 'index.json');
const CLIENTS_DIR = path.join(CORPUS_DIR, 'clients');
const MEETINGS_DIR = path.join(SAASLAUNCH_REPO, 'intake', 'fathom', 'meetings');

// ---------------------------------------------------------------------------
// env loader (minimal; .env.local only). Never prints key values.
// ---------------------------------------------------------------------------
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) process.env[key] = val;
  }
}
loadEnvFile(path.join(REPO_ROOT, '.env.local'));

function nowIso() {
  return new Date().toISOString();
}

function fail(msg, { exit = 1 } = {}) {
  console.error(`\n[FATAL] ${msg}`);
  process.exit(exit);
}

// The anti-fabrication gate (sha256 + normalizeForGate + gateQuoteAgainstTranscript)
// now lives in ./_fathom-gate.mjs, shared with the offline signal uploader.
// sha256 is imported above; createHash is still used directly for the manifest.

// ---------------------------------------------------------------------------
// Attribution map (spec §5.1): String()-normalize recording_id on both sides.
// Collision (one recording_id → >1 distinct slug) fails the guard, zero writes.
// ---------------------------------------------------------------------------
function buildAttributionMap() {
  if (!existsSync(INDEX_PATH)) {
    throw new Error(`corpus/index.json missing at ${INDEX_PATH}`);
  }
  try {
    JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  } catch (e) {
    throw new Error(`corpus/index.json unparseable: ${e.message}`);
  }
  if (!existsSync(CLIENTS_DIR)) {
    throw new Error(`corpus/clients/ directory missing at ${CLIENTS_DIR}`);
  }

  const clientFiles = readdirSync(CLIENTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  /** @type {Map<string, {client_slug:string, call_type:string, date:string|null, matched_by:string|null, source_path:string|null, title:string|null}>} */
  const map = new Map();
  const collisions = [];

  for (const fname of clientFiles) {
    const slug = fname.replace(/\.json$/, '');
    let obj;
    try {
      obj = JSON.parse(readFileSync(path.join(CLIENTS_DIR, fname), 'utf8'));
    } catch (e) {
      throw new Error(`unparseable client file ${fname}: ${e.message}`);
    }
    const meetings = Array.isArray(obj.fathom_meetings)
      ? obj.fathom_meetings
      : [];
    for (const m of meetings) {
      if (m == null || m.recording_id == null) continue;
      const id = String(m.recording_id);
      const existing = map.get(id);
      if (existing && existing.client_slug !== slug) {
        collisions.push({ recording_id: id, a: existing.client_slug, b: slug });
        continue;
      }
      if (!existing) {
        map.set(id, {
          client_slug: slug,
          call_type: typeof m.call_type === 'string' ? m.call_type : null,
          date: typeof m.date === 'string' ? m.date : null,
          matched_by: typeof m.matched_by === 'string' ? m.matched_by : null,
          source_path:
            typeof m.source_path === 'string' ? m.source_path : null,
          title: typeof m.title === 'string' ? m.title : null,
        });
      }
    }
  }

  if (collisions.length > 0) {
    throw new Error(
      `attribution collision (recording_id mapped to >1 client) — corpus drift, zero writes: ${JSON.stringify(
        collisions
      )}`
    );
  }
  return map;
}

// ---------------------------------------------------------------------------
// Phase A guard + build: read every Fathom file, build a transcript row per
// §4.1. Returns { rows, attributionMap, attributed, unattributed, perClient }.
// ---------------------------------------------------------------------------
const VALID_CALL_TYPES = new Set([
  'sales',
  'cs_checkin',
  'onboarding',
  'other',
  'unknown',
]);

function guardAndBuildRows() {
  if (!existsSync(MEETINGS_DIR)) {
    throw new Error(`fathom meetings dir missing at ${MEETINGS_DIR}`);
  }
  const meetingFiles = readdirSync(MEETINGS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (meetingFiles.length === 0) {
    throw new Error(`no *.json files in ${MEETINGS_DIR}`);
  }

  const attributionMap = buildAttributionMap();

  const rows = [];
  let attributed = 0;
  let unattributed = 0;
  const perClient = {};

  for (const fname of meetingFiles) {
    const full = path.join(MEETINGS_DIR, fname);
    let rawText;
    try {
      rawText = readFileSync(full, 'utf8');
    } catch (e) {
      throw new Error(`unreadable Fathom file ${fname}: ${e.message}`);
    }
    let raw;
    try {
      raw = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`unparseable Fathom file ${fname}: ${e.message}`);
    }
    if (raw.recording_id == null) {
      throw new Error(`Fathom file ${fname} missing recording_id`);
    }
    if (!Array.isArray(raw.transcript)) {
      throw new Error(`Fathom file ${fname} missing transcript[] array`);
    }

    const recordingId = String(raw.recording_id);
    const attr = attributionMap.get(recordingId) ?? null;
    const clientSlug = attr?.client_slug ?? null;
    let callType = attr?.call_type ?? 'unknown';
    if (!VALID_CALL_TYPES.has(callType)) callType = 'other';

    if (clientSlug) {
      attributed += 1;
      perClient[clientSlug] = (perClient[clientSlug] ?? 0) + 1;
    } else {
      unattributed += 1;
    }

    const callDate = raw.recording_start_time ?? raw.created_at ?? null;
    if (!callDate) {
      throw new Error(
        `Fathom file ${fname} has no recording_start_time or created_at (call_date is NOT NULL)`
      );
    }

    const transcript = raw.transcript;
    const summary =
      typeof raw.default_summary?.markdown_formatted === 'string'
        ? raw.default_summary.markdown_formatted
        : null;
    const actionItems = Array.isArray(raw.action_items)
      ? raw.action_items
      : [];

    rows.push({
      recording_id: recordingId,
      client_slug: clientSlug,
      title: typeof raw.title === 'string' ? raw.title : null,
      meeting_title:
        typeof raw.meeting_title === 'string' ? raw.meeting_title : null,
      call_type: callType,
      call_date: callDate,
      transcript,
      transcript_turns: transcript.length,
      summary,
      action_items: actionItems,
      share_url: typeof raw.share_url === 'string' ? raw.share_url : null,
      call_url: typeof raw.url === 'string' ? raw.url : null,
      raw_sha256: sha256(JSON.stringify(raw)),
      source_metadata: {
        source_repo: SAASLAUNCH_REPO,
        source_path:
          attr?.source_path ??
          path.join('intake', 'fathom', 'meetings', fname),
        recorded_by: raw.recorded_by ?? null,
        calendar_invitees_domains_type:
          raw.calendar_invitees_domains_type ?? null,
        transcript_language: raw.transcript_language ?? null,
        matched_by: attr?.matched_by ?? null,
        attribution_status: clientSlug ? 'attributed' : 'unattributed',
      },
    });
  }

  return {
    rows,
    attributionMap,
    meetingsTotal: meetingFiles.length,
    attributed,
    unattributed,
    perClient,
  };
}

// ---------------------------------------------------------------------------
// Supabase client (real runs only).
// ---------------------------------------------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    fail(
      'NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for a real run (use --dry-run to skip DB)'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function insertRunRow(supabase, runKind, { manifestHash, clientCount, sourceMetadata }) {
  // manifest_hash AND client_count are NOT NULL with no default on sl_refresh_runs
  // — both must be set on the initial 'running' insert, not just at completion.
  const { data, error } = await supabase
    .from('sl_refresh_runs')
    .insert({
      run_kind: runKind,
      status: 'running',
      dry_run: false,
      manifest_hash: manifestHash,
      client_count: clientCount,
      started_at: nowIso(),
      source_metadata: sourceMetadata,
    })
    .select()
    .single();
  if (error || !data) {
    fail(`insert sl_refresh_runs (${runKind}) failed: ${error?.message ?? 'no row'}`);
  }
  return data.id;
}

async function markRun(supabase, runId, patch) {
  await supabase
    .from('sl_refresh_runs')
    .update({ finished_at: nowIso(), ...patch })
    .eq('id', runId);
}

// ---------------------------------------------------------------------------
// Phase A — raw transcript sync (deterministic). Upsert on recording_id, skip
// rows whose stored raw_sha256 matches (idempotent).
// ---------------------------------------------------------------------------
async function runPhaseA(supabase, plan, manifestHash) {
  const runId = await insertRunRow(supabase, 'fathom_sync', {
    manifestHash,
    clientCount: Object.keys(plan.perClient ?? {}).length,
    sourceMetadata: {
      saaslaunch_repo: SAASLAUNCH_REPO,
      meetings_dir: MEETINGS_DIR,
      manifest_hash: manifestHash,
    },
  });

  try {
    // Read existing raw_sha256s to skip unchanged rows.
    const existingSha = new Map();
    {
      const { data, error } = await supabase
        .from('sl_fathom_transcripts')
        .select('recording_id, raw_sha256');
      if (error) {
        throw new Error(`select existing transcripts failed: ${error.message}`);
      }
      for (const r of data ?? []) existingSha.set(r.recording_id, r.raw_sha256);
    }

    let written = 0;
    let skipped = 0;
    for (const row of plan.rows) {
      if (!FORCE && existingSha.get(row.recording_id) === row.raw_sha256) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase.from('sl_fathom_transcripts').upsert(
        {
          recording_id: row.recording_id,
          client_slug: row.client_slug,
          title: row.title,
          meeting_title: row.meeting_title,
          call_type: row.call_type,
          call_date: row.call_date,
          transcript: row.transcript,
          summary: row.summary,
          action_items: row.action_items,
          share_url: row.share_url,
          call_url: row.call_url,
          transcript_turns: row.transcript_turns,
          raw_sha256: row.raw_sha256,
          source_metadata: row.source_metadata,
          updated_at: nowIso(),
        },
        { onConflict: 'recording_id' }
      );
      if (error) {
        throw new Error(
          `upsert sl_fathom_transcripts failed for ${row.recording_id}: ${error.message}`
        );
      }
      written += 1;
    }

    await markRun(supabase, runId, {
      status: 'succeeded',
      manifest_hash: manifestHash,
      source_metadata: {
        saaslaunch_repo: SAASLAUNCH_REPO,
        meetings_dir: MEETINGS_DIR,
        manifest_hash: manifestHash,
        total_calls: plan.meetingsTotal,
        attributed: plan.attributed,
        unattributed: plan.unattributed,
        written,
        skipped,
      },
    });
    console.error(
      `\n[OK] phase A: ${written} written, ${skipped} skipped (run ${runId}, ${plan.attributed} attributed / ${plan.unattributed} unattributed)`
    );
  } catch (e) {
    await markRun(supabase, runId, {
      status: 'failed',
      error_message: e.message,
    });
    fail(`phase A failed (run ${runId} marked failed): ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// --list-attributed — deterministic work-list of attributed calls (no DB/creds)
// ---------------------------------------------------------------------------
function listAttributedCalls() {
  const attributionMap = buildAttributionMap();
  const list = [];
  for (const [recordingId, attr] of attributionMap) {
    if (CLIENT_FILTER && attr.client_slug !== CLIENT_FILTER) continue;
    list.push({
      recording_id: recordingId,
      client_slug: attr.client_slug,
      call_type:
        typeof attr.call_type === 'string' ? attr.call_type : 'unknown',
      source_path: attr.source_path ?? null,
    });
  }
  list.sort((a, b) => {
    if (a.client_slug !== b.client_slug) {
      return a.client_slug.localeCompare(b.client_slug);
    }
    return a.recording_id.localeCompare(b.recording_id);
  });
  return list;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  // Signal extraction is now offline — never call any API from this script.
  if (EXTRACT_REQUESTED) {
    console.error(
      'Signal extraction is now offline: run /agency-extract-signals (local agents) + npm run agency:upload-signals'
    );
    process.exit(0);
  }

  // --list-attributed: deterministic work-list JSON (no DB/creds, like --dry-run).
  if (LIST_ATTRIBUTED) {
    let list;
    try {
      list = listAttributedCalls();
    } catch (e) {
      fail(`guard failed (no list produced): ${e.message}`);
    }
    console.log(JSON.stringify(list, null, 2));
    process.exit(0);
  }

  let plan;
  try {
    plan = guardAndBuildRows();
  } catch (e) {
    fail(`guard failed (no sync performed): ${e.message}`);
  }

  // Manifest = content hash of every Fathom raw_sha256 (sorted) + attribution counts.
  const manifest = createHash('sha256');
  for (const row of [...plan.rows].sort((a, b) => a.recording_id.localeCompare(b.recording_id))) {
    manifest.update(`${row.recording_id}:${row.raw_sha256}\n`);
  }
  manifest.update(`attributed:${plan.attributed}\nunattributed:${plan.unattributed}\n`);
  const manifestHash = 'sha256:' + manifest.digest('hex');

  if (DRY_RUN) {
    const summary = {
      dry_run: true,
      saaslaunch_repo: SAASLAUNCH_REPO,
      manifest_hash: manifestHash,
      meetings_total: plan.meetingsTotal,
      attributed: plan.attributed,
      unattributed: plan.unattributed,
      duplicate_attributions: 0, // collisions fail the guard before we get here
      would_write_raw: plan.rows.length,
      would_extract_from: plan.attributed,
      per_client_counts: plan.perClient,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.error(
      `\n[DRY-RUN] ${plan.meetingsTotal} meetings (${plan.attributed} attributed / ${plan.unattributed} unattributed). No DB, no creds, no LLM.`
    );
    process.exit(0);
  }

  const supabase = getSupabase();
  await runPhaseA(supabase, plan, manifestHash);
}

main().catch((e) => fail(`unexpected: ${e?.stack ?? e}`));
