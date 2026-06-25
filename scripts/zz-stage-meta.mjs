#!/usr/bin/env node
// Meta Ads Account Dashboard — staging transform (MCP shape -> clean staged JSON).
// Spec: docs/superpowers/specs/2026-06-25-meta-ads-dashboard-design.md
//
// The Claude-driven READ-ONLY MCP pull (ads_get_ad_entities) returns
// account-level daily rows + campaign-level rows with Meta-specific quirks:
//   - dates as "March 27, 2026" (not YYYY-MM-DD)
//   - field name amount_spent (not spend), purchase_roas (not roas)
//   - results / cost_per_result as nested objects:
//       {"value":"118 (Leads (form))"} | {"value":[{"indicator":..,"values":[{"value":91}]}]}
//   - "Not available" for metrics the objective doesn't track
//
// This script captures those raw responses verbatim and emits the clean staged
// shape consumed by zz-sync-meta.mjs (which does the formatted-string -> numeric
// parse-on-ingest). It also emits an account-only "pending" stub for accounts
// whose is_mcp_enabled is false (e.g. Anura, gated by Meta's rollout).
//
// Usage:
//   node scripts/zz-stage-meta.mjs --capture=scripts/data/meta/_capture/checkle.json
//   node scripts/zz-stage-meta.mjs --capture=... --out-dir=scripts/data/meta
//
// Capture file shape (verbatim MCP responses):
//   { "account_id":"408821226651871", "window":"last_90d",
//     "account_response":  <the exact ads_get_ad_entities account-level result>,
//     "campaign_response": <the exact ads_get_ad_entities campaign-level result> }
// Each *_response is the MCP object whose `ad_entities` is a JSON string.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'scripts', 'data', 'meta');

const ARGV = process.argv.slice(2);
const getFlag = (name) => {
  const f = ARGV.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3).trim() : null;
};

// Client registry — the two SaaSLaunch client accounts (+ statuses from
// ads_get_ad_accounts on 2026-06-25). The PKR test account is ignored.
const ACCOUNTS = {
  '408821226651871': {
    client_slug: 'checkle',
    account_name: 'Checkle',
    currency: 'USD',
    status: 'ACTIVE',
    is_mcp_enabled: true,
  },
  '209588006936422': {
    client_slug: 'anura',
    account_name: 'Anura',
    currency: 'USD',
    status: 'ACTIVE',
    is_mcp_enabled: false, // Meta: "Ads MCP is gradually being rolled out."
  },
};

const MONTHS = {
  January: '01', February: '02', March: '03', April: '04', May: '05',
  June: '06', July: '07', August: '08', September: '09', October: '10',
  November: '11', December: '12',
};

// "March 27, 2026" -> "2026-03-27" (manual parse, no timezone shift).
function normDate(s) {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const mm = MONTHS[m[1]];
  if (!mm) return null;
  return `${m[3]}-${mm}-${String(m[2]).padStart(2, '0')}`;
}

// Extract a plain numeric string from Meta's results / cost_per_result, which
// may be a bare string ("118 (Leads (form))", "$38.93 USD (Leads)"), a
// {value:string}, or a nested {value:[{indicator,values:[{value:N}]}]}.
// Returns a numeric string (for sync's parse-on-ingest) or null.
function extractResultNumber(field) {
  let v = field;
  if (v != null && typeof v === 'object' && 'value' in v) v = v.value;
  if (v == null) return null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const low = v.trim().toLowerCase();
    if (low === '' || low === 'not available' || low === 'n/a') return null;
    const m = /-?\d[\d,]*\.?\d*/.exec(v);
    return m ? m[0].replace(/,/g, '') : null;
  }
  if (Array.isArray(v)) {
    const val = v[0]?.values?.[0]?.value;
    return val == null ? null : String(val);
  }
  return null;
}

function parseEntities(response, label) {
  if (response == null) return [];
  let raw = response.ad_entities ?? response;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      throw new Error(`${label}: ad_entities is not valid JSON: ${e.message}`);
    }
  }
  if (!Array.isArray(raw)) throw new Error(`${label}: ad_entities is not an array`);
  return raw;
}

function stageRowsFromCapture(capture) {
  const accountId = String(capture.account_id);
  const meta = ACCOUNTS[accountId];
  if (!meta) throw new Error(`unknown account_id ${accountId} (not in registry)`);

  const accountEntities = parseEntities(capture.account_response, 'account_response');
  const campaignEntities = parseEntities(capture.campaign_response, 'campaign_response');

  const rows = [];

  // Account-level daily rows.
  for (const e of accountEntities) {
    rows.push({
      level: 'account',
      date: normDate(e.date_start),
      campaign_id: null,
      campaign_name: null,
      objective: null, // account-level has no single objective
      spend: e.amount_spent ?? null,
      impressions: e.impressions ?? null,
      reach: e.reach ?? null,
      frequency: e.frequency ?? null,
      link_clicks: null, // MCP catalog exposes no link-click count field
      clicks: e.clicks ?? null,
      ctr: e.ctr ?? null, // all-click CTR (no link-CTR field in this MCP)
      cpc: e.cpc ?? null,
      cpm: e.cpm ?? null,
      results: extractResultNumber(e.results),
      cost_per_result: extractResultNumber(e.cost_per_result),
      purchase_value: null, // no purchase-value field exposed
      roas: e.purchase_roas ?? null,
    });
  }

  // Campaign-level rows (window aggregate; dated to the window end as "as-of").
  for (const e of campaignEntities) {
    rows.push({
      level: 'campaign',
      date: normDate(e.date_stop ?? e.date_start),
      campaign_id: String(e.id),
      campaign_name: e.name ?? null,
      objective: e.objective ?? null,
      spend: e.amount_spent ?? null,
      impressions: e.impressions ?? null,
      reach: e.reach ?? null,
      frequency: e.frequency ?? null,
      link_clicks: null,
      clicks: e.clicks ?? null,
      ctr: e.ctr ?? null,
      cpc: e.cpc ?? null,
      cpm: e.cpm ?? null,
      results: extractResultNumber(e.results),
      cost_per_result: extractResultNumber(e.cost_per_result),
      purchase_value: null,
      roas: e.purchase_roas ?? null,
    });
  }

  const missingDates = rows.filter((r) => !r.date);
  if (missingDates.length) {
    throw new Error(`${missingDates.length} row(s) failed date normalization (check date_start/date_stop format)`);
  }

  return {
    account: { meta_account_id: accountId, ...meta },
    window: { date_preset: capture.window ?? 'unknown', pulled_at: capture.pulled_at ?? null },
    rows,
  };
}

// Account-only "pending" stub for a non-MCP-enabled account.
function stagePendingStub(accountId) {
  const meta = ACCOUNTS[accountId];
  if (!meta) throw new Error(`unknown account_id ${accountId}`);
  return {
    account: { meta_account_id: accountId, ...meta },
    window: { date_preset: 'pending', pulled_at: null },
    rows: [],
  };
}

function writeStaged(outDir, accountId, suffix, staged) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${accountId}-${suffix}.json`);
  writeFileSync(file, JSON.stringify(staged, null, 2) + '\n');
  return file;
}

function main() {
  const capturePath = getFlag('capture');
  const outDir = getFlag('out-dir') || DEFAULT_OUT;
  if (!capturePath) {
    console.error('usage: node scripts/zz-stage-meta.mjs --capture=<path> [--out-dir=<dir>]');
    process.exit(1);
  }
  const abs = path.isAbsolute(capturePath) ? capturePath : path.join(REPO_ROOT, capturePath);
  const capture = JSON.parse(readFileSync(abs, 'utf8'));

  const staged = stageRowsFromCapture(capture);
  const window = (capture.window ?? 'window').replace(/[^a-z0-9_]/gi, '');
  const f1 = writeStaged(outDir, staged.account.meta_account_id, window, staged);

  // Always (re)emit the Anura pending stub so the portfolio shows it.
  const anura = stagePendingStub('209588006936422');
  const f2 = writeStaged(outDir, '209588006936422', 'pending', anura);

  const accountRows = staged.rows.filter((r) => r.level === 'account').length;
  const campaignRows = staged.rows.filter((r) => r.level === 'campaign').length;
  console.error(
    `[staged] ${path.relative(REPO_ROOT, f1)} — ${accountRows} account + ${campaignRows} campaign rows\n` +
    `[staged] ${path.relative(REPO_ROOT, f2)} — Anura pending stub (0 rows)`
  );
}

main();
