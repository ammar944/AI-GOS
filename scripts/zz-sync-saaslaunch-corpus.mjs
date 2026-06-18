#!/usr/bin/env node
// Agency Intelligence Console — SaaSLaunch corpus sync.
// Snapshots corpus/index.json + corpus/clients/*.json into the sl_corpus_* tables.
//
// Usage:
//   npm run agency:sync-corpus                 # real sync (writes to Supabase)
//   npm run agency:sync-corpus -- --dry-run    # read-only plan, no DB writes, no creds needed
//   npm run agency:sync-corpus -- --rebuild    # run the two-step python build first, then sync
//   SAASLAUNCH_REPO=/path npm run agency:sync-corpus -- --dry-run
//
// Guards (refuse to sync on any failure; never partial-sync):
//   1. corpus/index.json exists and parses.
//   2. index.client_count === number of corpus/clients/*.json files.
//   3. every client file carries a fathom_meetings key.
// --rebuild runs `python3 -m pipeline.build.build_corpus` then
//   `python3 -m pipeline.build.join_fathom_to_corpus` from SAASLAUNCH_REPO, then re-guards.
// On any sync-time failure, a single sl_refresh_runs row with status='failed' is written.
// --dry-run does not touch the DB at all (no creds required).

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const REBUILD = process.argv.includes('--rebuild');
const SAASLAUNCH_REPO =
  process.env.SAASLAUNCH_REPO || '/Users/ammar/Dev-Projects/saaslaunch';

const CORPUS_DIR = path.join(SAASLAUNCH_REPO, 'corpus');
const INDEX_PATH = path.join(CORPUS_DIR, 'index.json');
const CLIENTS_DIR = path.join(CORPUS_DIR, 'clients');

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

// ---------------------------------------------------------------------------
// Guard phase: read + validate the corpus, compute manifest hash, build payloads.
// Returns { indexObj, manifestHash, clientCount, payloads } or throws.
// ---------------------------------------------------------------------------
function guardAndBuild() {
  if (!existsSync(INDEX_PATH)) {
    throw new Error(`corpus/index.json missing at ${INDEX_PATH}`);
  }
  let indexObj;
  try {
    indexObj = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  } catch (e) {
    throw new Error(`corpus/index.json unparseable: ${e.message}`);
  }
  const clients = Array.isArray(indexObj.clients) ? indexObj.clients : [];
  const indexCount =
    typeof indexObj.client_count === 'number'
      ? indexObj.client_count
      : clients.length;

  if (!existsSync(CLIENTS_DIR)) {
    throw new Error(`corpus/clients/ directory missing at ${CLIENTS_DIR}`);
  }
  const clientFiles = readdirSync(CLIENTS_DIR).filter((f) =>
    f.endsWith('.json')
  );
  if (clientFiles.length !== indexCount) {
    throw new Error(
      `client count mismatch: index.client_count=${indexCount} but clients/*.json=${clientFiles.length}`
    );
  }

  // index entry map by slug (for source_counts / sources_total)
  const indexBySlug = new Map();
  for (const c of clients) {
    if (c && typeof c.slug === 'string') indexBySlug.set(c.slug, c);
  }

  const sortedFiles = [...clientFiles].sort();
  const hash = createHash('sha256');
  const indexBytes = readFileSync(INDEX_PATH);
  hash.update('index.json:' + indexBytes.length + '\n');
  hash.update(indexBytes);

  const payloads = [];
  for (const fname of sortedFiles) {
    const slug = fname.replace(/\.json$/, '');
    const full = path.join(CLIENTS_DIR, fname);
    let raw;
    try {
      raw = readFileSync(full, 'utf8');
    } catch (e) {
      throw new Error(`unreadable client file ${fname}: ${e.message}`);
    }
    const bytes = Buffer.from(raw, 'utf8');
    hash.update('\n' + fname + ':' + bytes.length + '\n');
    hash.update(bytes);

    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      throw new Error(`unparseable client file ${fname}: ${e.message}`);
    }
    if (!Array.isArray(obj.fathom_meetings)) {
      throw new Error(
        `client file ${fname} missing fathom_meetings (two-step join not run)`
      );
    }
    const risk = obj.risk || {};
    const idx = indexBySlug.get(slug) || {};
    const sourceCounts =
      idx.source_counts && typeof idx.source_counts === 'object'
        ? idx.source_counts
        : {};
    payloads.push({
      client_slug: slug,
      client_display_name: typeof obj.client === 'string' ? obj.client : null,
      client_json: obj,
      risk_tier: risk.tier ?? idx.risk_tier ?? null,
      churn_score:
        typeof risk.churn_score === 'number' ? risk.churn_score : null,
      gap_score: typeof risk.gap_score === 'number' ? risk.gap_score : null,
      sources_total: typeof idx.sources_total === 'number' ? idx.sources_total : null,
      source_counts: sourceCounts,
      actions_count: Array.isArray(obj.actions) ? obj.actions.length : 0,
      promises_count: Array.isArray(obj.promises) ? obj.promises.length : 0,
      gaps_count: Array.isArray(obj.gaps) ? obj.gaps.length : 0,
      fathom_meetings_count: obj.fathom_meetings.length,
      file: fname,
    });
  }

  const manifestHash = 'sha256:' + hash.digest('hex');
  return { indexObj, manifestHash, clientCount: indexCount, payloads };
}

// ---------------------------------------------------------------------------
// --rebuild: run the two-step python pipeline, then re-guard.
// ---------------------------------------------------------------------------
function runRebuild() {
  const buildDir = path.join(SAASLAUNCH_REPO, 'pipeline', 'build');
  if (!existsSync(buildDir)) {
    fail(
      `--rebuild: pipeline/build not found at ${buildDir} (SAASLAUNCH_REPO=${SAASLAUNCH_REPO})`
    );
  }
  const steps = [
    ['build_corpus', ['python3', '-m', 'pipeline.build.build_corpus']],
    ['join_fathom_to_corpus', ['python3', '-m', 'pipeline.build.join_fathom_to_corpus']],
  ];
  for (const [label, cmd] of steps) {
    console.error(`[rebuild] running ${label}: ${cmd.join(' ')} (cwd=${SAASLAUNCH_REPO})`);
    try {
      execFileSync(cmd[0], cmd.slice(1), {
        cwd: SAASLAUNCH_REPO,
        stdio: 'inherit',
        env: process.env,
      });
    } catch (e) {
      fail(`--rebuild step ${label} failed: ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sync phase (real run only): write the four sl_corpus_* tables + refresh run.
// ---------------------------------------------------------------------------
async function syncToSupabase({ indexObj, manifestHash, clientCount, payloads }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    fail(
      'NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for a real sync (use --dry-run to skip DB)'
    );
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runKind = REBUILD ? 'corpus_rebuild' : 'corpus_sync';
  const startedAt = nowIso();
  const runMeta = { saaslaunch_repo: SAASLAUNCH_REPO, corpus_dir: CORPUS_DIR };

  // 1) create refresh_runs row as 'running'
  const { data: runRow, error: runErr } = await supabase
    .from('sl_refresh_runs')
    .insert({
      run_kind: runKind,
      status: 'running',
      dry_run: false,
      manifest_hash: manifestHash,
      client_count: clientCount,
      started_at: startedAt,
      source_metadata: runMeta,
    })
    .select()
    .single();
  if (runErr || !runRow) {
    fail(`insert sl_refresh_runs failed: ${runErr?.message ?? 'no row'}`);
  }
  const runId = runRow.id;

  const markFailed = async (message) => {
    await supabase
      .from('sl_refresh_runs')
      .update({ status: 'failed', finished_at: nowIso(), error_message: message })
      .eq('id', runId);
  };

  try {
    // 2) corpus snapshot (full index_json)
    const { data: snapRow, error: snapErr } = await supabase
      .from('sl_corpus_snapshots')
      .insert({
        refresh_run_id: runId,
        manifest_hash: manifestHash,
        client_count: clientCount,
        index_json: indexObj,
        captured_at: nowIso(),
      })
      .select()
      .single();
    if (snapErr || !snapRow) {
      throw new Error(`insert sl_corpus_snapshots failed: ${snapErr?.message ?? 'no row'}`);
    }
    const snapId = snapRow.id;

    // 3) per-client snapshot history (ALL before touching current, so a failure
    //    never leaves the current view reflecting a partial run)
    for (const p of payloads) {
      const { error: csErr } = await supabase
        .from('sl_corpus_client_snapshots')
        .insert({
          refresh_run_id: runId,
          snapshot_id: snapId,
          client_slug: p.client_slug,
          client_display_name: p.client_display_name,
          client_json: p.client_json,
          risk_tier: p.risk_tier,
          churn_score: p.churn_score,
          gap_score: p.gap_score,
          sources_total: p.sources_total,
          source_counts: p.source_counts,
          actions_count: p.actions_count,
          promises_count: p.promises_count,
          gaps_count: p.gaps_count,
          fathom_meetings_count: p.fathom_meetings_count,
          captured_at: nowIso(),
        });
      if (csErr) {
        throw new Error(
          `insert sl_corpus_client_snapshots failed for ${p.client_slug}: ${csErr.message}`
        );
      }
    }

    // 4) upsert current state
    for (const p of payloads) {
      const { error: curErr } = await supabase
        .from('sl_corpus_clients_current')
        .upsert(
          {
            client_slug: p.client_slug,
            client_display_name: p.client_display_name,
            latest_refresh_run_id: runId,
            latest_snapshot_id: snapId,
            manifest_hash: manifestHash,
            risk_tier: p.risk_tier,
            churn_score: p.churn_score,
            gap_score: p.gap_score,
            sources_total: p.sources_total,
            source_counts: p.source_counts,
            actions_count: p.actions_count,
            promises_count: p.promises_count,
            gaps_count: p.gaps_count,
            fathom_meetings_count: p.fathom_meetings_count,
            client_json: p.client_json,
            captured_at: nowIso(),
            updated_at: nowIso(),
          },
          { onConflict: 'client_slug' }
        );
      if (curErr) {
        throw new Error(
          `upsert sl_corpus_clients_current failed for ${p.client_slug}: ${curErr.message}`
        );
      }
    }

    // 5) mark succeeded
    const { error: okErr } = await supabase
      .from('sl_refresh_runs')
      .update({ status: 'succeeded', finished_at: nowIso() })
      .eq('id', runId);
    if (okErr) {
      throw new Error(`mark sl_refresh_runs succeeded failed: ${okErr.message}`);
    }

    console.error(
      `\n[OK] synced ${payloads.length} clients (run ${runId}, ${runKind}, manifest ${manifestHash})`
    );
  } catch (e) {
    await markFailed(e.message);
    fail(`sync failed (run ${runId} marked failed): ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  if (REBUILD) {
    console.error('[rebuild] --rebuild mutates the corpus on disk regardless of --dry-run');
    runRebuild();
  }

  let plan;
  try {
    plan = guardAndBuild();
  } catch (e) {
    // guard failure — no refresh_runs row in dry-run; in a real run we have no
    // manifest yet to attribute, so report and exit non-zero without a partial sync.
    fail(`guard failed (no sync performed): ${e.message}`);
  }

  if (DRY_RUN) {
    const summary = {
      dry_run: true,
      saaslaunch_repo: SAASLAUNCH_REPO,
      manifest_hash: plan.manifestHash,
      client_count: plan.clientCount,
      tables_that_would_be_written: [
        'sl_refresh_runs (1, status=succeeded on success)',
        'sl_corpus_snapshots (1)',
        `sl_corpus_client_snapshots (${plan.payloads.length})`,
        `sl_corpus_clients_current (upsert ${plan.payloads.length})`,
      ],
      clients: plan.payloads.map((p) => ({
        slug: p.client_slug,
        display_name: p.client_display_name,
        risk_tier: p.risk_tier,
        churn_score: p.churn_score,
        gap_score: p.gap_score,
        actions: p.actions_count,
        promises: p.promises_count,
        gaps: p.gaps_count,
        fathom_meetings: p.fathom_meetings_count,
      })),
    };
    console.log(JSON.stringify(summary, null, 2));
    console.error(
      `\n[DRY-RUN] ${plan.clientCount} clients would sync (manifest ${plan.manifestHash}). No DB writes.`
    );
    process.exit(0);
  }

  await syncToSupabase(plan);
}

main().catch((e) => fail(`unexpected: ${e?.stack ?? e}`));