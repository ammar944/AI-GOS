#!/usr/bin/env node
// Meta Ads Account Dashboard — deterministic sync uploader.
// Spec: docs/superpowers/specs/2026-06-25-meta-ads-dashboard-design.md
//
// Reads staged JSON (produced out-of-band by a Claude-driven READ-ONLY Meta MCP
// pull — same offline-extract + deterministic-uploader split as Fathom) and
// upserts it into sl_meta_ad_accounts + sl_meta_insights. NO LLM, NO network
// beyond Supabase, NO write/mutation MCP tool.
//
// Parse-on-ingest: the MCP returns formatted strings ("$178.07 USD", "1.33%",
// "7,899", "Not available"); this script converts them to numerics, mapping
// "Not available"/"" -> null. roas/cost_per_result are null for non-conversion
// objectives (e.g. Checkle traffic).
//
// Idempotency: per-row raw_sha256 change detection. A second run on the same
// staged JSON is a no-op. The DB also enforces a unique key on
// (meta_account_id, date, level, coalesce(campaign_id, '__account__')).
//
// Usage:
//   npm run meta:sync                      # sync every scripts/data/meta/*.json
//   npm run meta:sync -- --dry-run         # plan only — NO DB, NO creds
//   npm run meta:sync -- --file=path.json  # sync one staged file
//   npm run meta:sync -- --force           # re-write even if raw_sha256 unchanged
//
// Staged file shape:
//   {
//     "account": { "client_slug","meta_account_id","account_name","currency",
//                  "status","is_mcp_enabled" },
//     "window":  { ... free-form provenance ... },
//     "rows": [ { "level":"account"|"campaign", "date":"YYYY-MM-DD",
//                 "campaign_id","campaign_name","objective",
//                 "spend","impressions","reach","frequency","link_clicks",
//                 "clicks","ctr","cpc","cpm","results","cost_per_result",
//                 "purchase_value","roas" } ]
//   }

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STAGE_DIR = path.join(REPO_ROOT, 'scripts', 'data', 'meta');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const ARGV = process.argv.slice(2);
const DRY_RUN = ARGV.includes('--dry-run');
const FORCE = ARGV.includes('--force');
const FILE_FLAG = (() => {
  const flag = ARGV.find((a) => a.startsWith('--file='));
  return flag ? flag.slice('--file='.length).trim() || null : null;
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

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const nowIso = () => new Date().toISOString();

function fail(msg, { exit = 1 } = {}) {
  console.error(`\n[FATAL] ${msg}`);
  process.exit(exit);
}

// ---------------------------------------------------------------------------
// Parse-on-ingest: formatted string -> numeric | null.
//   "$178.07 USD" -> 178.07 · "1.33%" -> 1.33 · "7,899" -> 7899
//   "Not available" / "" / "N/A" / "—" -> null
// ---------------------------------------------------------------------------
const NULL_TOKENS = new Set(['', 'not available', 'n/a', 'na', '-', '—', '–']);

export function parseMetric(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (NULL_TOKENS.has(s.toLowerCase())) return null;
  // Strip currency symbols/codes, thousands separators, percent signs.
  const cleaned = s.replace(/[$,%]/g, '').replace(/[A-Za-z]/g, '').trim();
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Canonical raw representation for change detection (fixed key order).
export function rowRawCanonical(r) {
  return JSON.stringify({
    level: r.level ?? null,
    date: r.date ?? null,
    campaign_id: r.campaign_id ?? null,
    campaign_name: r.campaign_name ?? null,
    objective: r.objective ?? null,
    spend: r.spend ?? null,
    impressions: r.impressions ?? null,
    reach: r.reach ?? null,
    frequency: r.frequency ?? null,
    link_clicks: r.link_clicks ?? null,
    clicks: r.clicks ?? null,
    ctr: r.ctr ?? null,
    cpc: r.cpc ?? null,
    cpm: r.cpm ?? null,
    results: r.results ?? null,
    cost_per_result: r.cost_per_result ?? null,
    purchase_value: r.purchase_value ?? null,
    roas: r.roas ?? null,
  });
}

const idemKey = (accountId, date, level, campaignId) =>
  `${accountId}|${date}|${level}|${campaignId ?? '__account__'}`;

// ---------------------------------------------------------------------------
// Guard + build: read every staged file, validate, parse rows. Fail closed
// (zero writes) on any malformed file.
// ---------------------------------------------------------------------------
function listStagedFiles() {
  if (FILE_FLAG) {
    const abs = path.isAbsolute(FILE_FLAG)
      ? FILE_FLAG
      : path.join(REPO_ROOT, FILE_FLAG);
    if (!existsSync(abs)) throw new Error(`staged file not found: ${abs}`);
    return [abs];
  }
  if (!existsSync(STAGE_DIR)) {
    throw new Error(`staging dir missing at ${STAGE_DIR} (run the MCP pull first)`);
  }
  const files = readdirSync(STAGE_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(STAGE_DIR, f));
  if (files.length === 0) {
    throw new Error(`no *.json staged files in ${STAGE_DIR}`);
  }
  return files;
}

function guardAndBuild() {
  const files = listStagedFiles();
  const accounts = []; // { account, parsedRows[], rawRowCount }

  for (const file of files) {
    let staged;
    try {
      staged = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`unparseable staged file ${path.basename(file)}: ${e.message}`);
    }
    const acct = staged.account;
    if (!acct || typeof acct.meta_account_id !== 'string' || !acct.meta_account_id) {
      throw new Error(`${path.basename(file)}: account.meta_account_id missing`);
    }
    if (typeof acct.client_slug !== 'string' || !acct.client_slug) {
      throw new Error(`${path.basename(file)}: account.client_slug missing`);
    }
    const rawRows = Array.isArray(staged.rows) ? staged.rows : [];
    const parsedRows = [];
    for (const r of rawRows) {
      if (r == null) continue;
      if (r.level !== 'account' && r.level !== 'campaign') {
        throw new Error(
          `${path.basename(file)}: row.level must be 'account'|'campaign' (got ${JSON.stringify(r.level)})`
        );
      }
      if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
        throw new Error(`${path.basename(file)}: row.date must be YYYY-MM-DD (got ${JSON.stringify(r.date)})`);
      }
      if (r.level === 'campaign' && (r.campaign_id == null || r.campaign_id === '')) {
        throw new Error(`${path.basename(file)}: campaign-level row missing campaign_id (${r.date})`);
      }
      parsedRows.push({
        meta_account_id: acct.meta_account_id,
        date: r.date,
        level: r.level,
        campaign_id: r.level === 'account' ? null : String(r.campaign_id),
        campaign_name: r.campaign_name ?? null,
        objective: r.objective ?? null,
        spend: parseMetric(r.spend),
        impressions: parseMetric(r.impressions),
        reach: parseMetric(r.reach),
        frequency: parseMetric(r.frequency),
        link_clicks: parseMetric(r.link_clicks),
        clicks: parseMetric(r.clicks),
        ctr: parseMetric(r.ctr),
        cpc: parseMetric(r.cpc),
        cpm: parseMetric(r.cpm),
        results: parseMetric(r.results),
        cost_per_result: parseMetric(r.cost_per_result),
        purchase_value: parseMetric(r.purchase_value),
        roas: parseMetric(r.roas),
        currency: r.currency ?? acct.currency ?? null,
        raw_sha256: sha256(rowRawCanonical(r)),
      });
    }
    accounts.push({
      account: {
        meta_account_id: acct.meta_account_id,
        client_slug: acct.client_slug,
        account_name: acct.account_name ?? null,
        currency: acct.currency ?? null,
        status: acct.status ?? null,
        is_mcp_enabled: acct.is_mcp_enabled === true,
      },
      parsedRows,
      rawRowCount: rawRows.length,
    });
  }
  return accounts;
}

function computeManifest(accounts) {
  const h = createHash('sha256');
  for (const a of accounts) {
    const keyed = a.parsedRows
      .map((r) => `${idemKey(r.meta_account_id, r.date, r.level, r.campaign_id)}:${r.raw_sha256}`)
      .sort();
    h.update(`account:${a.account.meta_account_id}\n`);
    for (const k of keyed) h.update(`${k}\n`);
  }
  return 'sha256:' + h.digest('hex');
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

async function insertRunRow(supabase, { manifestHash, clientCount, sourceMetadata }) {
  // manifest_hash AND client_count are NOT NULL with no default — set on the
  // initial 'running' insert, not just at completion.
  const { data, error } = await supabase
    .from('sl_refresh_runs')
    .insert({
      run_kind: 'meta_sync',
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
    fail(`insert sl_refresh_runs (meta_sync) failed: ${error?.message ?? 'no row'}`);
  }
  return data.id;
}

async function markRun(supabase, runId, patch) {
  await supabase
    .from('sl_refresh_runs')
    .update({ finished_at: nowIso(), ...patch })
    .eq('id', runId);
}

async function syncAccount(supabase, { account, parsedRows }) {
  // 1) Upsert the account row first (FK target for insights). Omit connected_at
  //    so it defaults on insert and is preserved on update.
  {
    const { error } = await supabase
      .from('sl_meta_ad_accounts')
      .upsert(
        {
          meta_account_id: account.meta_account_id,
          client_slug: account.client_slug,
          account_name: account.account_name,
          currency: account.currency,
          status: account.status,
          is_mcp_enabled: account.is_mcp_enabled,
        },
        { onConflict: 'meta_account_id' }
      );
    if (error) {
      throw new Error(`upsert sl_meta_ad_accounts (${account.meta_account_id}) failed: ${error.message}`);
    }
  }

  // 2) Idempotent insights upsert (script-managed: insert new / update changed /
  //    skip unchanged by raw_sha256). Avoids ON CONFLICT on the expression index.
  const { data: existing, error: selErr } = await supabase
    .from('sl_meta_insights')
    .select('id, date, level, campaign_id, raw_sha256')
    .eq('meta_account_id', account.meta_account_id);
  if (selErr) {
    throw new Error(`select existing insights (${account.meta_account_id}) failed: ${selErr.message}`);
  }
  const existingByKey = new Map();
  for (const e of existing ?? []) {
    existingByKey.set(idemKey(account.meta_account_id, e.date, e.level, e.campaign_id), e);
  }

  const toInsert = [];
  const toUpdate = [];
  let skipped = 0;
  for (const row of parsedRows) {
    const k = idemKey(row.meta_account_id, row.date, row.level, row.campaign_id);
    const ex = existingByKey.get(k);
    if (ex && !FORCE && ex.raw_sha256 === row.raw_sha256) {
      skipped += 1;
      continue;
    }
    const payload = { ...row, synced_at: nowIso() };
    if (ex) toUpdate.push({ id: ex.id, payload });
    else toInsert.push(payload);
  }

  if (toInsert.length) {
    const { error } = await supabase.from('sl_meta_insights').insert(toInsert);
    if (error) throw new Error(`insert insights (${account.meta_account_id}) failed: ${error.message}`);
  }
  for (const u of toUpdate) {
    const { error } = await supabase.from('sl_meta_insights').update(u.payload).eq('id', u.id);
    if (error) throw new Error(`update insight ${u.id} failed: ${error.message}`);
  }

  return { inserted: toInsert.length, updated: toUpdate.length, skipped };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  let accounts;
  try {
    accounts = guardAndBuild();
  } catch (e) {
    fail(`guard failed (no sync performed): ${e.message}`);
  }

  const manifestHash = computeManifest(accounts);
  const totalRows = accounts.reduce((n, a) => n + a.parsedRows.length, 0);

  if (DRY_RUN) {
    const summary = {
      dry_run: true,
      staging_dir: FILE_FLAG ? path.dirname(path.resolve(REPO_ROOT, FILE_FLAG)) : STAGE_DIR,
      manifest_hash: manifestHash,
      accounts: accounts.map((a) => {
        const sample = a.parsedRows[0] ?? null;
        const firstCampaign = a.parsedRows.find((r) => r.level === 'campaign') ?? null;
        return {
          meta_account_id: a.account.meta_account_id,
          client_slug: a.account.client_slug,
          is_mcp_enabled: a.account.is_mcp_enabled,
          raw_rows: a.rawRowCount,
          parsed_rows: a.parsedRows.length,
          account_rows: a.parsedRows.filter((r) => r.level === 'account').length,
          campaign_rows: a.parsedRows.filter((r) => r.level === 'campaign').length,
          parsed_sample_account: sample,
          parsed_sample_campaign: firstCampaign,
        };
      }),
      would_write_rows: totalRows,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.error(
      `\n[DRY-RUN] ${accounts.length} account(s), ${totalRows} rows parsed. No DB, no creds. ("Not available" -> null shown in parsed_sample.)`
    );
    process.exit(0);
  }

  const supabase = getSupabase();
  const runId = await insertRunRow(supabase, {
    manifestHash,
    clientCount: accounts.length,
    sourceMetadata: {
      staging_dir: STAGE_DIR,
      accounts: accounts.map((a) => a.account.meta_account_id),
      manifest_hash: manifestHash,
    },
  });

  try {
    const perAccount = {};
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const a of accounts) {
      const res = await syncAccount(supabase, a);
      perAccount[a.account.meta_account_id] = res;
      inserted += res.inserted;
      updated += res.updated;
      skipped += res.skipped;
    }

    await markRun(supabase, runId, {
      status: 'succeeded',
      manifest_hash: manifestHash,
      source_metadata: {
        staging_dir: STAGE_DIR,
        accounts: accounts.map((a) => a.account.meta_account_id),
        manifest_hash: manifestHash,
        inserted,
        updated,
        skipped,
        per_account: perAccount,
      },
    });
    console.error(
      `\n[OK] meta_sync: ${inserted} inserted, ${updated} updated, ${skipped} skipped across ${accounts.length} account(s) (run ${runId}).`
    );
  } catch (e) {
    await markRun(supabase, runId, { status: 'failed', error_message: e.message });
    fail(`meta_sync failed (run ${runId} marked failed): ${e.message}`);
  }
}

main().catch((e) => fail(`unexpected: ${e?.stack ?? e}`));
