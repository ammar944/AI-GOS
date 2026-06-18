#!/usr/bin/env node
// Account-Health Cockpit — Fathom offline-extraction signal UPLOADER (spec §5.3).
//
// Deterministic ONLY. There is NO metered LLM step here. Signal extraction is
// done OFFLINE by local Claude agents (the user's CLI subscription, no metered
// API), which stage one or more JSON files under tmp/fathom-extract/*.json.
// This uploader RE-APPLIES the shared anti-fabrication gate to every staged
// candidate against the STORED raw transcript (sl_fathom_transcripts.transcript)
// before it writes anything, then idempotently replaces a recording's signals.
//
// Usage:
//   npm run agency:upload-signals                    # real upload (writes to Supabase)
//   npm run agency:upload-signals -- --dry-run       # read + gate + report — NO DB, NO creds
//   npm run agency:upload-signals -- --client=acme   # restrict to one client_slug
//   SAASLAUNCH_REPO=/path npm run agency:upload-signals -- --dry-run
//
//   # Upstream (offline, no metered API):
//   #   /agency-extract-signals   (local agents stage JSON into tmp/fathom-extract/)
//
// Staged file shape: each tmp/fathom-extract/*.json is a JSON array of:
//   { recording_id, client_slug, signal_type, severity, quote, speaker,
//     rationale, suggested_action }
//
// Gate (spec §5.3 — fail closed, never write an ungated quote):
//   For EVERY candidate we re-fetch that recording's stored transcript and run
//   gateQuoteAgainstTranscript(quote, transcript). A candidate is REJECTED when:
//     - recording_id is missing/unattributed (no stored transcript row), or
//     - the normalized quote is < MIN_QUOTE_LENGTH (12) chars, or
//     - the normalized quote is not a verbatim substring of exactly one turn.
//   Survivors carry quote_sha256 over the normalized quote.
//
// Idempotent write (per recording_id, only for recordings with >=1 survivor):
//   delete existing sl_fathom_signals for that recording, then insert survivors.
//   Records one sl_refresh_runs row run_kind='fathom_extract'.
//
// --dry-run reads + gates + reports only; never touches the DB; needs no creds.
// An empty/absent tmp/fathom-extract reports 0 staged gracefully (no crash).

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256, gateQuoteAgainstTranscript } from './_fathom-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const STAGE_DIR = path.join(REPO_ROOT, 'tmp', 'fathom-extract');
const EXTRACTION_VERSION = '1';
const EXTRACTOR = 'agency-extract-signals';

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const ARGV = process.argv.slice(2);
const DRY_RUN = ARGV.includes('--dry-run');
const CLIENT_FILTER = (() => {
  const flag = ARGV.find((a) => a.startsWith('--client='));
  return flag ? flag.slice('--client='.length).trim() || null : null;
})();

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

// Canonical taxonomy. MUST stay in lockstep with the DB CHECK constraints in
// supabase/migrations/20260619_account_health_cockpit_fathom.sql AND the Zod
// enums in src/lib/agency-intelligence/contracts.ts (FathomSignalType /
// FathomSignalSeverity). A .mjs cannot import the TS enums at runtime, so these
// are mirrored here and pinned by a drift-guard test
// (src/lib/agency-intelligence/fathom/__tests__/taxonomy-drift.test.ts).
export const VALID_SIGNAL_TYPES = new Set([
  'churn_escalation',
  'going_dark',
  'payment_risk',
  'verbal_promise',
  'upsell_intent',
]);
export const VALID_SEVERITIES = new Set(['low', 'medium', 'high']);

// ---------------------------------------------------------------------------
// Stage phase: read every tmp/fathom-extract/*.json (each = array of candidates).
// Returns { candidates, stagedFiles, manifestHash }. Absent/empty dir → [].
// Throws only on a present-but-unparseable / non-array file (fail closed).
// ---------------------------------------------------------------------------
function readStagedCandidates() {
  if (!existsSync(STAGE_DIR)) {
    return { candidates: [], stagedFiles: [], manifestHash: 'sha256:' + createHash('sha256').digest('hex') };
  }
  const files = readdirSync(STAGE_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const hash = createHash('sha256');
  const candidates = [];
  const stagedFiles = [];

  for (const fname of files) {
    const full = path.join(STAGE_DIR, fname);
    let rawText;
    try {
      rawText = readFileSync(full, 'utf8');
    } catch (e) {
      throw new Error(`unreadable staged file ${fname}: ${e.message}`);
    }
    const bytes = Buffer.from(rawText, 'utf8');
    hash.update(fname + ':' + bytes.length + '\n');
    hash.update(bytes);

    let arr;
    try {
      arr = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`unparseable staged file ${fname}: ${e.message}`);
    }
    if (!Array.isArray(arr)) {
      throw new Error(`staged file ${fname} is not a JSON array of candidates`);
    }
    stagedFiles.push(fname);
    for (let i = 0; i < arr.length; i++) {
      candidates.push({ ...arr[i], _file: fname, _index: i });
    }
  }

  return {
    candidates,
    stagedFiles,
    manifestHash: 'sha256:' + hash.digest('hex'),
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
      'NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for a real upload (use --dry-run to skip DB)'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Gate one candidate against a stored transcript. Returns
// { accepted, reason, row? }. row is the insert-ready sl_fathom_signals shape.
// ---------------------------------------------------------------------------
function gateCandidate(cand, transcriptRow) {
  const recordingId =
    cand.recording_id == null ? null : String(cand.recording_id);
  if (!recordingId) {
    return { accepted: false, reason: 'missing_recording_id' };
  }
  if (!transcriptRow) {
    return { accepted: false, reason: 'unattributed_no_transcript' };
  }
  const transcript = Array.isArray(transcriptRow.transcript)
    ? transcriptRow.transcript
    : null;
  if (!transcript) {
    return { accepted: false, reason: 'transcript_not_array' };
  }

  const gate = gateQuoteAgainstTranscript(cand.quote ?? '', transcript);
  if (!gate.accepted) {
    return { accepted: false, reason: gate.reason };
  }

  // Reject (never coerce) candidates outside the canonical taxonomy. Coercing an
  // unknown/fabricated type or severity to a real value silently mislabels data,
  // and the DB CHECK would reject it anyway — after the (formerly) destructive
  // delete had already run. Fail closed at the gate instead.
  if (!VALID_SIGNAL_TYPES.has(cand.signal_type)) {
    return {
      accepted: false,
      reason: `invalid_signal_type:${cand.signal_type ?? 'missing'}`,
    };
  }
  if (!VALID_SEVERITIES.has(cand.severity)) {
    return {
      accepted: false,
      reason: `invalid_severity:${cand.severity ?? 'missing'}`,
    };
  }
  // Signals only exist for attributed calls — client_slug is NOT NULL in the DB.
  // Prefer the stored transcript's slug; fall back to the candidate's declared
  // slug; reject if neither resolves to a non-empty string.
  const clientSlug =
    typeof transcriptRow.client_slug === 'string' && transcriptRow.client_slug.trim()
      ? transcriptRow.client_slug
      : typeof cand.client_slug === 'string' && cand.client_slug.trim()
        ? cand.client_slug
        : null;
  if (!clientSlug) {
    return { accepted: false, reason: 'missing_client_slug' };
  }

  const row = {
    recording_id: recordingId,
    client_slug: clientSlug,
    signal_type: cand.signal_type,
    severity: cand.severity,
    quote: cand.quote,
    quote_sha256: gate.normalizedQuoteSha256,
    speaker:
      typeof cand.speaker === 'string' && cand.speaker.trim()
        ? cand.speaker
        : gate.speaker ?? null,
    call_date: transcriptRow.call_date ?? null,
    source_metadata: {
      extractor: EXTRACTOR,
      extraction_version: EXTRACTION_VERSION,
      model: 'offline-agent',
      quote_match: {
        matched_turn_index: gate.matchedTurnIndex,
        matched_speaker: gate.speaker ?? null,
        matched_timestamp: gate.timestamp ?? null,
      },
      rationale: typeof cand.rationale === 'string' ? cand.rationale : null,
      suggested_action:
        typeof cand.suggested_action === 'string'
          ? cand.suggested_action
          : null,
    },
  };
  return { accepted: true, row };
}

// ---------------------------------------------------------------------------
// Resolve stored transcripts for the candidate recording_ids.
// dry-run with no creds → returns an empty map (every candidate then rejects as
// unattributed_no_transcript, which is the honest report when DB is unavailable).
// ---------------------------------------------------------------------------
async function fetchTranscripts(supabase, recordingIds) {
  const map = new Map();
  if (!supabase || recordingIds.length === 0) return map;
  const { data, error } = await supabase
    .from('sl_fathom_transcripts')
    .select('recording_id, client_slug, call_date, transcript')
    .in('recording_id', recordingIds);
  if (error) {
    throw new Error(`select sl_fathom_transcripts failed: ${error.message}`);
  }
  for (const r of data ?? []) map.set(String(r.recording_id), r);
  return map;
}

// ---------------------------------------------------------------------------
// Gate every candidate. Returns { survivorsByRecording, accepted, rejected,
// rejections, consideredCandidates }.
// supabase may be null (dry-run, no creds) → transcripts unavailable.
// ---------------------------------------------------------------------------
async function gateAll(supabase, candidates) {
  // Apply --client filter first (on the candidate's declared slug).
  const considered = CLIENT_FILTER
    ? candidates.filter((c) => c.client_slug === CLIENT_FILTER)
    : candidates;

  const recordingIds = [
    ...new Set(
      considered
        .map((c) => (c.recording_id == null ? null : String(c.recording_id)))
        .filter((id) => id)
    ),
  ];

  const transcripts = await fetchTranscripts(supabase, recordingIds);

  const survivorsByRecording = new Map();
  const rejections = [];
  let accepted = 0;

  for (const cand of considered) {
    const recordingId =
      cand.recording_id == null ? null : String(cand.recording_id);
    const transcriptRow = recordingId ? transcripts.get(recordingId) ?? null : null;
    const result = gateCandidate(cand, transcriptRow);
    if (!result.accepted) {
      rejections.push({
        file: cand._file,
        index: cand._index,
        recording_id: recordingId,
        reason: result.reason,
      });
      continue;
    }
    accepted += 1;
    const list = survivorsByRecording.get(recordingId) ?? [];
    list.push(result.row);
    survivorsByRecording.set(recordingId, list);
  }

  return {
    survivorsByRecording,
    accepted,
    rejected: rejections.length,
    rejections,
    consideredCandidates: considered.length,
  };
}

// Dedupe survivor rows for one recording on the DB unique key
// (recording_id, signal_type, quote_sha256); last write wins.
function dedupeSurvivors(survivors) {
  const byKey = new Map();
  for (const r of survivors) {
    byKey.set(`${r.signal_type}|${r.quote_sha256}`, r);
  }
  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Idempotent write: per recording with >=1 survivor, upsert the fresh set then
// delete its stale rows (insert-before-delete — never leaves a recording empty).
// One sl_refresh_runs row run_kind='fathom_extract' frames the work.
// ---------------------------------------------------------------------------
async function upload(supabase, gateResult, { stagedFiles, candidates, manifestHash }) {
  const startedAt = nowIso();
  // client_count is NOT NULL with no default on sl_refresh_runs — distinct
  // client_slugs among the recordings we are about to write.
  const clientCount = new Set(
    [...gateResult.survivorsByRecording.values()].flat().map((r) => r.client_slug)
  ).size;
  const { data: runRow, error: runErr } = await supabase
    .from('sl_refresh_runs')
    .insert({
      run_kind: 'fathom_extract',
      status: 'running',
      dry_run: false,
      manifest_hash: manifestHash,
      client_count: clientCount,
      started_at: startedAt,
      source_metadata: {
        stage_dir: STAGE_DIR,
        staged_files: stagedFiles,
        candidates,
        client_filter: CLIENT_FILTER,
      },
    })
    .select()
    .single();
  if (runErr || !runRow) {
    fail(`insert sl_refresh_runs (fathom_extract) failed: ${runErr?.message ?? 'no row'}`);
  }
  const runId = runRow.id;

  const recordingFailures = [];
  try {
    let recordingsWritten = 0;
    let signalsInserted = 0;
    for (const [recordingId, survivors] of gateResult.survivorsByRecording) {
      // Dedupe within the recording on the DB unique key
      // (recording_id, signal_type, quote_sha256) so an in-batch collision
      // (same quote extracted twice as the same type) can't fail the upsert.
      const deduped = dedupeSurvivors(survivors);
      try {
        // Write FIRST (upsert is idempotent on the unique key), THEN delete the
        // stale rows for this recording. Insert-before-delete guarantees a
        // recording is NEVER left with zero signals if a step fails — worst case
        // is a few orphaned stale rows on a transient error, never data loss.
        const { error: upErr } = await supabase
          .from('sl_fathom_signals')
          .upsert(deduped, {
            onConflict: 'recording_id,signal_type,quote_sha256',
          });
        if (upErr) {
          throw new Error(`upsert failed: ${upErr.message}`);
        }
        // Drop any prior rows for this recording that are not in the fresh set.
        const keepShas = deduped.map((r) => r.quote_sha256);
        const { error: delErr } = await supabase
          .from('sl_fathom_signals')
          .delete()
          .eq('recording_id', recordingId)
          .not('quote_sha256', 'in', `(${keepShas.map((s) => `"${s}"`).join(',')})`);
        if (delErr) {
          throw new Error(`delete-stale failed: ${delErr.message}`);
        }
        recordingsWritten += 1;
        signalsInserted += deduped.length;
      } catch (e) {
        // Isolate a per-recording failure: record it and keep going so one bad
        // recording cannot skip every later one. Nothing was deleted before the
        // write, so the recording keeps its (freshly upserted or prior) signals.
        recordingFailures.push({ recording_id: recordingId, error: e.message });
      }
    }

    const runStatus = recordingFailures.length === 0 ? 'succeeded' : 'failed';
    await supabase
      .from('sl_refresh_runs')
      .update({
        status: runStatus,
        finished_at: nowIso(),
        error_message:
          recordingFailures.length > 0
            ? `${recordingFailures.length} recording(s) failed to write`
            : null,
        source_metadata: {
          stage_dir: STAGE_DIR,
          staged_files: stagedFiles,
          candidates,
          accepted: gateResult.accepted,
          rejected: gateResult.rejected,
          manifest_hash: manifestHash,
          client_filter: CLIENT_FILTER,
          recordings_written: recordingsWritten,
          signals_inserted: signalsInserted,
          recording_failures: recordingFailures,
        },
      })
      .eq('id', runId);

    console.error(
      `\n[${runStatus === 'succeeded' ? 'OK' : 'PARTIAL'}] fathom_extract: ${signalsInserted} signals across ${recordingsWritten} recordings ` +
        `(${gateResult.accepted} accepted / ${gateResult.rejected} rejected` +
        `${recordingFailures.length > 0 ? `, ${recordingFailures.length} recordings FAILED` : ''}, run ${runId}, manifest ${manifestHash})`
    );
    if (recordingFailures.length > 0) {
      fail(
        `${recordingFailures.length} recording(s) failed to write (successful writes persisted, run ${runId} marked failed): ` +
          recordingFailures.map((f) => `${f.recording_id}: ${f.error}`).join('; ')
      );
    }
  } catch (e) {
    await supabase
      .from('sl_refresh_runs')
      .update({ status: 'failed', finished_at: nowIso(), error_message: e.message })
      .eq('id', runId);
    fail(`upload failed (run ${runId} marked failed): ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  let staged;
  try {
    staged = readStagedCandidates();
  } catch (e) {
    fail(`staged read failed (no upload performed): ${e.message}`);
  }

  if (staged.candidates.length === 0) {
    const summary = {
      dry_run: DRY_RUN,
      stage_dir: STAGE_DIR,
      staged_files: staged.stagedFiles,
      candidates: 0,
      accepted: 0,
      rejected: 0,
      client_filter: CLIENT_FILTER,
      note: existsSync(STAGE_DIR)
        ? 'no candidates staged'
        : 'tmp/fathom-extract absent — nothing to upload',
    };
    console.log(JSON.stringify(summary, null, 2));
    console.error(
      `\n[${DRY_RUN ? 'DRY-RUN' : 'OK'}] 0 staged candidates. No DB writes.`
    );
    process.exit(0);
  }

  if (DRY_RUN) {
    // Read + gate + report. No creds, no DB → transcripts unavailable, so the
    // report is the staged shape + gate verdicts that DON'T need the transcript
    // (missing_recording_id, too_short) plus an honest unattributed verdict for
    // everything that would need a stored transcript to confirm.
    const gateResult = await gateAll(null, staged.candidates);
    const survivorRecordings = [...gateResult.survivorsByRecording.keys()];
    const summary = {
      dry_run: true,
      stage_dir: STAGE_DIR,
      staged_files: staged.stagedFiles,
      manifest_hash: staged.manifestHash,
      client_filter: CLIENT_FILTER,
      candidates_total: staged.candidates.length,
      candidates_considered: gateResult.consideredCandidates,
      accepted_without_db: gateResult.accepted,
      rejected_without_db: gateResult.rejected,
      note: 'dry-run uses NO creds; transcripts are not fetched, so quotes that '
        + 'need the stored transcript report reason="unattributed_no_transcript". '
        + 'Run without --dry-run to gate against sl_fathom_transcripts.',
      rejection_reasons: gateResult.rejections.reduce((acc, r) => {
        acc[r.reason] = (acc[r.reason] ?? 0) + 1;
        return acc;
      }, {}),
      would_write_recordings: survivorRecordings.length,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.error(
      `\n[DRY-RUN] ${staged.candidates.length} staged candidate(s) across ${staged.stagedFiles.length} file(s). No DB, no creds.`
    );
    process.exit(0);
  }

  const supabase = getSupabase();
  const gateResult = await gateAll(supabase, staged.candidates);
  await upload(supabase, gateResult, {
    stagedFiles: staged.stagedFiles,
    candidates: staged.candidates.length,
    manifestHash: staged.manifestHash,
  });
}

// Only run when invoked as a script (`node zz-upload-fathom-signals.mjs`), not
// when imported (e.g. by the taxonomy-drift test that reads VALID_SIGNAL_TYPES).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => fail(`unexpected: ${e?.stack ?? e}`));
}
