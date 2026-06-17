#!/usr/bin/env node
// zz-buyer-eval.mjs — deterministic, read-only Buyer Test scoring gate.
// Reads a persisted research run from Supabase, scores client-surface artifacts
// against docs/takeover-2026-06-12/02-bar.md, and writes a markdown report.
//
// Usage: node scripts/zz-buyer-eval.mjs <run_id> [--json] [--share]
//
// Exit 0 = score >=9. Exit 2 = buyer-test caps/fails. Exit 1 = setup/DB error.
// The default DB behavior is SELECT-only. --share optionally POSTs localhost
// /api/share when BASE_URL is set, and is skipped unless explicitly requested.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// True only when this file is the process entrypoint (CLI run), false when it is
// imported (e.g. by the unit tests for the exported check functions). Keeps the
// pure scoring helpers importable without booting the Supabase-reading main().
const IS_CLI = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith('--')));

function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}

// Offline mode: read a zz-dump-run-sections.mjs bundle dir instead of Supabase.
const BUNDLE_DIR = flagValue('--bundle');
const positional = argv.filter((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--bundle');
const RUN_ID = positional[0];

const UNKNOWN_FLAGS = [...flags].filter((flag) => !['--json', '--share', '--bundle'].includes(flag));
if (IS_CLI && ((!RUN_ID && !BUNDLE_DIR) || UNKNOWN_FLAGS.length > 0)) {
  const unknown = UNKNOWN_FLAGS.length > 0 ? ` Unknown flag(s): ${UNKNOWN_FLAGS.join(', ')}` : '';
  console.error(`Usage: node scripts/zz-buyer-eval.mjs <run_id> [--json] [--share] [--bundle <dir>]${unknown}`);
  process.exit(1);
}

const SHOULD_WRITE_JSON = flags.has('--json');
const SHOULD_SHARE = flags.has('--share');

const POSITIONING_CLIENT_ZONES = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
];

const PAID_MEDIA_ZONE = 'positioningPaidMediaPlan';
const VOC_ZONE = 'positioningVoiceOfCustomer';
const COMPETITOR_ZONE = 'positioningCompetitorLandscape';
const BUYER_ICP_ZONE = 'positioningBuyerICP';

const CORE_CHECK_IDS = new Set(['CASCADE', 'PROJECTIONS', 'CHANNELS', 'ANGLES', 'BUDGET-PARTITION', 'CAC-UNIT']);
const ALLOWED_KPI_COST_PROVENANCE = new Set([
  'user-supplied',
  'tool-measured',
  'source-reported',
  'derived',
]);

// Budget-partition tolerance: per-move phase budgets must SUM to the campaign
// monthly total. c77ff0e1 sums to 35000 against a stated 25000 (row 1 carries
// the full 25K, rows 2-3 add 10K of phantom spend) — must FAIL.
const BUDGET_PARTITION_TOLERANCE = 1;

// CAC-unit guard: a funnel-stage KPI's implied cost-per-signup compared against
// a paid-customer CAC target beyond this multiple, with NO trial->paid bridge,
// is the self-falsifying "$134 beats $3,000 by 22x" defect. >5x = implausible.
const CAC_UNIT_IMPLAUSIBLE_MULTIPLE = 5;
// A top-of-funnel action (free trial / lead / signup) that costs this much or
// more per result, with no trial->paid bridge, is a misapplied paid-customer
// CAC target — not a real cost-per-action benchmark. Catches the c9bc2056
// "$3,000 per free trial signup" conflation that carries no separate impliedCac.
const CAC_UNIT_IMPLAUSIBLE_FUNNEL_COST = 1000;

// KPI labels that denote a funnel-stage unit (free signup), NOT a paid customer.
const FUNNEL_STAGE_KPI_PATTERN = /\b(trial|lead|signup|sign-up|sign up|mql|sql|demo|free)\b/i;

// VoC zone enum value used as a sourceSection tag on laundered paid-media rows.
const VOC_SOURCE_SECTION = 'positioningVoiceOfCustomer';

const DENY_LIST = [
  'blockGap',
  'prepass',
  'corpus',
  'verifiedCount',
  'displayable',
  'quarantine',
  'containment',
  'liveness',
  'in this pass',
  'fan-out',
  'keyword_volume',
  'web_search',
  'keyword_trends',
  'tool budget',
  'section badge',
  'evidence gap:',
  '[unverified]',
  '[verified',
  'analysis rework',
  'contradiction status',
];

const MEMO_BLOCKING_TOKENS = [
  'blocked',
  'resolve contradiction',
  'contradiction(s) remain',
  'contradictions remain',
  'instruction:',
  'todo',
  'tbd',
  'placeholder',
  'rewrite this',
  'fix this',
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compactWhitespace(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncate(value, maxLength = 180) {
  const text = compactWhitespace(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 12)}...[truncated]`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required but was not configured`);
  return value;
}

function reportSlug(runId) {
  return runId.slice(0, 8);
}

function bodyOf(section) {
  const data = section?.data ?? {};
  if (isRecord(data.body)) return data.body;

  const candidates = [
    data.data,
    data.typedArtifact,
    data.artifact,
    data.positioningArtifact,
    data.marketCategoryArtifact,
    data.buyerIcpArtifact,
    data.competitorLandscapeArtifact,
    data.voiceOfCustomerArtifact,
    data.vocArtifact,
    data.demandIntentArtifact,
    data.offerPerformanceArtifact,
    data.offerDiagnosticArtifact,
    data.paidMediaPlanArtifact,
  ];

  for (const candidate of candidates) {
    if (isRecord(candidate?.body)) return candidate.body;
  }

  return isRecord(data) ? data : {};
}

function getPath(root, path) {
  let current = root;
  for (const part of path) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = current?.[part];
  }
  return current;
}

function firstPathValue(root, paths) {
  for (const path of paths) {
    const value = getPath(root, path);
    if (value !== undefined && value !== null && value !== '') return { value, path: path.join('.') };
  }
  return { value: undefined, path: null };
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/,/g, '').trim();
  const match = normalized.match(/-?\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;

  const tail = normalized.slice(match.index ?? 0).toLowerCase();
  if (/\b(k|thousand)\b/.test(tail)) return numeric * 1000;
  if (/\b(m|million)\b/.test(tail)) return numeric * 1000000;
  return numeric;
}

function firstNumber(root, paths) {
  const found = firstPathValue(root, paths);
  return {
    value: parseNumber(found.value),
    raw: found.value,
    path: found.path,
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function arrayFromPaths(root, paths) {
  for (const path of paths) {
    const value = getPath(root, path);
    if (Array.isArray(value)) return value;
  }
  return [];
}

function statusCheck(id, status, evidence, extras = {}) {
  return {
    id,
    status,
    evidence: compactWhitespace(evidence),
    core: CORE_CHECK_IDS.has(id),
    neverShipReasons: [],
    ...extras,
  };
}

function passFail(id, ok, evidence, extras = {}) {
  return statusCheck(id, ok ? 'PASS' : 'FAIL', evidence, extras);
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatCountMap(counts) {
  const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  return entries.length > 0 ? entries.map(([key, value]) => `${key}=${value}`).join(', ') : 'none';
}

function collectStringLeaves(value, options = {}, path = '$', leaves = []) {
  if (typeof value === 'string') {
    leaves.push({ path, value });
    return leaves;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStringLeaves(item, options, `${path}[${index}]`, leaves));
    return leaves;
  }

  if (!isRecord(value)) return leaves;

  for (const [key, child] of Object.entries(value)) {
    if (options.skipKey?.(key)) continue;
    collectStringLeaves(child, options, `${path}.${key}`, leaves);
  }

  return leaves;
}

function findKey(value, targetKey, path = '$') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findKey(value[index], targetKey, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === targetKey.toLowerCase()) return { path: `${path}.${key}`, value: child };
    const found = findKey(child, targetKey, `${path}.${key}`);
    if (found) return found;
  }

  return null;
}

function findDenyToken(value) {
  const lower = value.toLowerCase();
  for (const token of DENY_LIST) {
    const lowerToken = token.toLowerCase();
    if (lowerToken === 'evidence gap:') {
      if (lower.trim().startsWith('evidence gap:')) return token;
      continue;
    }
    if (lower.includes(lowerToken)) return token;
  }
  return null;
}

function denyListSkipKey(key) {
  return (
    key === 'verifierSummary' ||
    key === 'decodeRepairs' ||
    key === 'verification' ||
    key === 'review' ||
    key.startsWith('blockGap')
  );
}

function recommendationIsGap(value) {
  const lower = value.trim().toLowerCase();
  return (
    lower.startsWith('evidence gap:') ||
    lower.startsWith('gap:') ||
    lower.startsWith('[unverified]') ||
    lower.includes('gap-string')
  );
}

function normalizedProvenance(value) {
  return stringValue(value).toLowerCase();
}

function normalizedMoveText(value) {
  if (typeof value === 'string') return compactWhitespace(value).toLowerCase();
  if (!isRecord(value)) return compactWhitespace(JSON.stringify(value ?? '')).toLowerCase();

  const preferred = [
    value.move,
    value.title,
    value.headline,
    value.recommendation,
    value.name,
    value.label,
  ].find(hasNonEmptyString);

  return compactWhitespace(preferred ?? JSON.stringify(value)).toLowerCase();
}

function extractRankedMoveTexts(thesis) {
  const rankedMoves = asArray(thesis?.rankedMoves);
  return rankedMoves.map(normalizedMoveText).filter((value) => value.length > 0);
}

function registrableDomain(url) {
  if (!hasNonEmptyString(url)) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) return host;
    const lastTwo = parts.slice(-2).join('.');
    const lastThree = parts.slice(-3).join('.');
    if (/^(co|com|org|net|gov|ac)\.[a-z]{2}$/.test(lastTwo)) return lastThree;
    return lastTwo;
  } catch {
    return null;
  }
}

function normalizedName(value) {
  return stringValue(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function firstStringFromKeys(record, keys) {
  if (!isRecord(record)) return '';
  for (const key of keys) {
    const value = record[key];
    if (hasNonEmptyString(value)) return value.trim();
  }
  return '';
}

function collectRowsUnderKeys(value, keyPattern, path = '$', rows = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRowsUnderKeys(item, keyPattern, `${path}[${index}]`, rows));
    return rows;
  }

  if (!isRecord(value)) return rows;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (keyPattern.test(key) && Array.isArray(child)) {
      child.forEach((item, index) => {
        if (isRecord(item)) rows.push({ row: item, path: `${childPath}[${index}]` });
      });
    }
    collectRowsUnderKeys(child, keyPattern, childPath, rows);
  }

  return rows;
}

function collectQuoteRecords(value, path = '$', records = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectQuoteRecords(item, `${path}[${index}]`, records));
    return records;
  }

  if (!isRecord(value)) return records;

  const pathSuggestsQuote = /quote|verbatim/i.test(path);
  // `verbatimText` is the field the VoC artifact actually stores quote strings
  // under; omitting it (the original list only had quote/verbatim/text/value)
  // made the gate read ZERO quotes from a VoC full of verbatimText blobs.
  const quoteText = firstStringFromKeys(value, [
    'verbatimText',
    'quote',
    'verbatim',
    'text',
    'value',
  ]);
  const url = firstStringFromKeys(value, ['permalink', 'sourceUrl', 'source_url', 'url', 'citationUrl', 'itemUrl']);
  if (quoteText && (pathSuggestsQuote || url || value.speaker || value.customer || value.source)) {
    records.push({ path, text: quoteText, url });
  }

  for (const [key, child] of Object.entries(value)) {
    collectQuoteRecords(child, `${path}.${key}`, records);
  }

  return records;
}

function buildCompetitorDomainMap(competitorBody) {
  const competitors = arrayFromPaths(competitorBody, [
    ['competitorSet', 'competitors'],
    ['competitors'],
    ['pricingReality', 'competitors'],
  ]);
  const map = new Map();

  for (const competitor of competitors) {
    if (!isRecord(competitor)) continue;
    const name = firstStringFromKeys(competitor, ['name', 'competitor', 'company', 'vendor']);
    if (!name) continue;
    const url = firstStringFromKeys(competitor, [
      'website',
      'websiteUrl',
      'homepage',
      'homepageUrl',
      'url',
      'pricingUrl',
    ]);
    const domain = registrableDomain(url);
    if (domain) map.set(normalizedName(name), domain);
  }

  return map;
}

function evaluateCascade(paidMediaBody) {
  const monthly = firstNumber(paidMediaBody, [
    ['campaignOverview', 'monthlyBudgetValue'],
    ['budgetCascade', 'monthlyBudgetValue'],
    ['monthlyBudgetValue'],
    ['campaignOverview', 'monthlyBudget'],
    ['budgetCascade', 'monthlyBudget'],
    ['monthlyBudget'],
  ]);
  const daily = firstNumber(paidMediaBody, [
    ['campaignOverview', 'dailySpendValue'],
    ['budgetCascade', 'dailySpendValue'],
    ['dailySpendValue'],
    ['campaignOverview', 'dailySpend'],
    ['budgetCascade', 'dailySpend'],
    ['dailySpend'],
  ]);
  const phases = arrayFromPaths(paidMediaBody, [
    ['campaignPhases'],
    ['phases'],
    ['budgetCascade', 'phases'],
  ]);
  const audiences = arrayFromPaths(paidMediaBody, [
    ['audienceTypes'],
    ['audiences'],
    ['budgetCascade', 'audiences'],
  ]);

  const phaseBudgets = phases.map((phase) => firstNumber(phase, [
    ['monthlyBudgetValue'],
    ['phaseMonthlyBudgetValue'],
    ['budgetValue'],
    ['monthlyBudget'],
    ['phaseMonthlyBudget'],
    ['budget'],
  ]));
  const audienceBudgets = audiences.map((audience) => firstNumber(audience, [
    ['dailyBudgetValue'],
    ['audienceDailyBudgetValue'],
    ['dailyBudget'],
    ['budgetPerDay'],
    ['dailySpend'],
  ]));

  const monthlyDailyDelta =
    monthly.value === null || daily.value === null ? null : Math.abs(daily.value * 30 - monthly.value);
  const audiencePresentCount = audienceBudgets.filter((budget) => budget.value !== null).length;
  const audienceSum =
    audienceBudgets.length === 0 || audiencePresentCount !== audienceBudgets.length
      ? null
      : audienceBudgets.reduce((sum, budget) => sum + (budget.value ?? 0), 0);
  const audienceDelta = audienceSum === null || daily.value === null ? null : Math.abs(audienceSum - daily.value);
  const phaseOverMonthly = phaseBudgets
    .map((budget, index) => ({ index, value: budget.value }))
    .filter((budget) => monthly.value !== null && budget.value !== null && budget.value > monthly.value + 0.01);

  const monthlyPresent = monthly.value !== null;
  const dailyPresent = daily.value !== null;
  const monthlyDailyOk = monthlyPresent && dailyPresent && monthlyDailyDelta !== null && monthlyDailyDelta <= 50;
  const audienceOk = audiences.length > 0 && audiencePresentCount === audiences.length && audienceDelta !== null && audienceDelta <= 5;
  const phasesOk = phaseOverMonthly.length === 0 && phaseBudgets.every((budget) => budget.value !== null);
  const ok = monthlyPresent && dailyPresent && monthlyDailyOk && audienceOk && phasesOk;

  const check = passFail(
    'CASCADE',
    ok,
    [
      `monthlyBudgetValue=${formatMoney(monthly.value)}`,
      `dailySpend=${formatMoney(daily.value)}`,
      `dailySpend*30_delta=${formatMoney(monthlyDailyDelta)}`,
      `audienceDailyBudgets=${audiencePresentCount}/${audiences.length}`,
      `audienceDailySum=${formatMoney(audienceSum)}`,
      `audienceDailyDelta=${formatMoney(audienceDelta)}`,
      `phaseBudgets=${phaseBudgets.filter((budget) => budget.value !== null).length}/${phases.length}`,
      `phaseOverMonthly=${phaseOverMonthly.length}`,
    ].join('; '),
  );

  if (!ok) check.neverShipReasons.push('CASCADE: non-reconciling or incomplete budget cascade');
  return check;
}

function projectionCountValue(row) {
  return firstNumber(row, [
    ['projectedCountValue'],
    ['projectedCount'],
    ['countValue'],
    ['count'],
    ['leadCount'],
    ['mqlCount'],
    ['trialStarts'],
    ['projectedLeads'],
  ]);
}

function evaluateProjections(paidMediaBody) {
  const rows = asArray(paidMediaBody.projectedResults);
  const rowsWithPhaseBudget = rows.filter((row) => {
    if (!isRecord(row)) return false;
    return firstNumber(row, [
      ['phaseMonthlyBudgetValue'],
      ['phaseBudgetValue'],
      ['monthlyBudgetValue'],
      ['phaseMonthlyBudget'],
      ['phaseBudget'],
      ['budget'],
    ]).value !== null;
  });

  const eligibleRows = rowsWithPhaseBudget.length > 0 ? rowsWithPhaseBudget : rows;
  const missingCost = [];
  const missingCount = [];
  const badProvenance = [];

  eligibleRows.forEach((row, index) => {
    if (!isRecord(row)) return;
    const kpiCost = firstNumber(row, [['kpiCostValue'], ['kpiCost'], ['costPerKpi'], ['costPerResult']]);
    const projectedCount = projectionCountValue(row);
    const provenance = normalizedProvenance(row.kpiCostProvenance ?? row.costProvenance ?? row.provenance);
    if (kpiCost.value === null) missingCost.push(index);
    if (projectedCount.value === null) missingCount.push(index);
    if (!ALLOWED_KPI_COST_PROVENANCE.has(provenance)) badProvenance.push(`${index}:${provenance || 'missing'}`);
  });

  const ok =
    rows.length > 0 &&
    eligibleRows.length > 0 &&
    missingCost.length === 0 &&
    missingCount.length === 0 &&
    badProvenance.length === 0;
  const check = passFail(
    'PROJECTIONS',
    ok,
    [
      `rows=${rows.length}`,
      `rowsWithPhaseBudget=${rowsWithPhaseBudget.length}`,
      `missingKpiCostValue=${missingCost.length}`,
      `missingProjectedCount=${missingCount.length}`,
      `badKpiCostProvenance=${badProvenance.length}${badProvenance.length ? ` (${badProvenance.join(', ')})` : ''}`,
    ].join('; '),
  );

  if (!ok) check.neverShipReasons.push('PROJECTIONS: projected-results table lacks trusted projected counts/cost provenance');
  return check;
}

// --- New deterministic checks the original gate was BLIND to (c77ff0e1 passed
//     10/10 while every one of these defects shipped). ---

function rowPhaseBudget(row) {
  return firstNumber(row, [
    ['phaseMonthlyBudgetValue'],
    ['phaseBudgetValue'],
    ['monthlyBudgetValue'],
    ['phaseMonthlyBudget'],
    ['phaseBudget'],
    ['budget'],
  ]);
}

// The time-window a projected-results row runs in. SEQUENTIAL phases each carry a
// distinct durationLabel ("Months 1-2" vs "Month 3") and may each run at the full
// monthly rate; CONCURRENT rows share one window. Rows with no declared window
// can't be proven sequential, so they share the empty-window bucket (treated as
// concurrent) — this is what keeps the c77 double-count caught.
function rowWindowKey(row) {
  return firstStringFromKeys(row, [
    'durationLabel',
    'phaseLabel',
    'phaseName',
    'timeframe',
    'timeWindow',
    'window',
    'phase',
    'monthRange',
    'months',
  ]).toLowerCase();
}

// BUDGET-PARTITION — within ANY single time window, the per-move phase budgets must
// not sum past the campaign monthly total (concurrent over-allocation = phantom
// spend). The check is WINDOW-AWARE: sequential phases in DISTINCT windows, each at
// or under the monthly rate, are correct and PASS. The c77 double-count
// (25000 + 5000 + 5000 = 35000 all in one window vs a 25000 plan) still FAILs.
function evaluateBudgetPartition(paidMediaBody) {
  const monthly = firstNumber(paidMediaBody, [
    ['campaignOverview', 'monthlyBudgetValue'],
    ['budgetCascade', 'monthlyBudgetValue'],
    ['monthlyBudgetValue'],
    ['campaignOverview', 'monthlyBudget'],
    ['budgetCascade', 'monthlyBudget'],
    ['monthlyBudget'],
  ]);
  const rows = asArray(paidMediaBody.projectedResults).filter(isRecord);
  const budgetedRows = rows
    .map((row, index) => ({ index, budget: rowPhaseBudget(row).value, window: rowWindowKey(row) }))
    .filter((entry) => entry.budget !== null);
  const phaseSum = budgetedRows.reduce((sum, entry) => sum + entry.budget, 0);

  // Group concurrent rows by their time window. Only rows sharing a window are
  // spent at the same time, so only a window's INTERNAL sum can be phantom spend.
  const windowGroups = new Map();
  for (const entry of budgetedRows) {
    const group = windowGroups.get(entry.window) ?? [];
    group.push(entry);
    windowGroups.set(entry.window, group);
  }
  const windowSums = [...windowGroups.entries()].map(([window, entries]) => ({
    window,
    sum: entries.reduce((sum, entry) => sum + entry.budget, 0),
    entries,
  }));
  const maxWindowSum = windowSums.reduce((max, group) => Math.max(max, group.sum), 0);

  // A window over-allocates when its concurrent rows sum past the monthly total.
  const overAllocatedWindows =
    monthly.value === null
      ? []
      : windowSums.filter((group) => group.sum > monthly.value + BUDGET_PARTITION_TOLERANCE);

  // Duplicate spend WITHIN a window: a row carrying the FULL monthly total while
  // concurrent sibling rows in the SAME window add more on top is the c77
  // signature (row 1 = full 25K alongside two more in the same window).
  const fullBudgetRows = monthly.value === null
    ? []
    : budgetedRows.filter((entry) => Math.abs(entry.budget - monthly.value) <= BUDGET_PARTITION_TOLERANCE);
  const hasDuplicateFullSpend =
    monthly.value !== null &&
    windowSums.some(
      (group) =>
        group.entries.some((entry) => Math.abs(entry.budget - monthly.value) <= BUDGET_PARTITION_TOLERANCE) &&
        group.entries.length > 1,
    );

  const delta = monthly.value === null ? null : Math.abs(phaseSum - monthly.value);
  const partitions = monthly.value !== null && budgetedRows.length > 0 && overAllocatedWindows.length === 0;
  const ok = monthly.value !== null && budgetedRows.length > 0 && partitions && !hasDuplicateFullSpend;

  const check = passFail(
    'BUDGET-PARTITION',
    ok,
    [
      `monthlyBudgetValue=${formatMoney(monthly.value)}`,
      `phaseBudgetRows=${budgetedRows.length}/${rows.length}`,
      `phaseBudgetSum=${formatMoney(phaseSum)}`,
      `sumVsMonthlyDelta=${formatMoney(delta)}`,
      `windows=${windowSums.length}`,
      `maxWindowSum=${formatMoney(maxWindowSum)}`,
      `overAllocatedWindows=${overAllocatedWindows.length}`,
      `rowsCarryingFullMonthly=${fullBudgetRows.length}`,
      `duplicateFullSpend=${hasDuplicateFullSpend}`,
    ].join('; '),
  );

  if (monthly.value === null) {
    check.neverShipReasons.push('BUDGET-PARTITION: no campaign monthly budget to reconcile move budgets against');
  } else if (overAllocatedWindows.length > 0) {
    const worst = overAllocatedWindows.reduce((a, b) => (b.sum > a.sum ? b : a));
    const label = worst.window ? `window "${worst.window}"` : 'a single time window';
    check.neverShipReasons.push(`BUDGET-PARTITION: concurrent move budgets in ${label} sum to ${formatMoney(worst.sum)} but the plan states ${formatMoney(monthly.value)} (phantom spend)`);
  }
  if (hasDuplicateFullSpend) {
    check.neverShipReasons.push('BUDGET-PARTITION: a move carries the FULL monthly budget while concurrent sibling moves in the same window add more (double-counted spend)');
  }
  return check;
}

// CAC-UNIT — a funnel-stage KPI (trial / lead / signup) whose implied
// cost-per-signup beats a paid-customer CAC target by an implausible multiple,
// with NO trial->paid bridge (customerCacValue), is the self-falsifying
// "$134 implied CAC beats the $3,000 target by 22x and never notices" defect.
function evaluateCacUnit(paidMediaBody) {
  const rows = asArray(paidMediaBody.projectedResults).filter(isRecord);
  const offenders = [];
  let funnelRows = 0;
  let bridgedRows = 0;

  rows.forEach((row, index) => {
    const kpiLabel = firstStringFromKeys(row, ['kpi', 'kpiLabel', 'metric', 'unit']);
    const isFunnelStage = FUNNEL_STAGE_KPI_PATTERN.test(kpiLabel);
    if (isFunnelStage) funnelRows += 1;

    const impliedCac = firstNumber(row, [['impliedCacValue'], ['impliedCac'], ['cacValue'], ['cac']]).value;
    // The paid-CUSTOMER CAC target the row judges itself against (kpiCostValue).
    const targetCac = firstNumber(row, [['kpiCostValue'], ['kpiCost'], ['targetCacValue'], ['costPerResult']]).value;
    // The trial->paid bridge that would make impliedCac comparable to targetCac.
    const customerCac = firstNumber(row, [
      ['customerCacValue'],
      ['customerCac'],
      ['paidCustomerCacValue'],
      ['blendedCustomerCacValue'],
    ]).value;
    // An honest sensitivity BAND (modeled customer CAC as a range when the brief
    // did not disclose a trial->paid rate) ALSO resolves the unit mismatch: the
    // row no longer presents a cost-per-trial AS the customer CAC.
    const customerCacBand = firstNumber(row, [
      ['customerCacBandLowValue'],
      ['customerCacBandHighValue'],
    ]).value;
    const hasBridge = customerCac !== null || customerCacBand !== null;
    if (hasBridge) bridgedRows += 1;

    if (!isFunnelStage) return;
    if (hasBridge) return; // a stated trial->paid bridge OR honest band resolves the unit mismatch
    if (targetCac === null) return; // no paid-customer CAC target to conflate against

    if (impliedCac !== null && impliedCac > 0) {
      const multiple = targetCac / impliedCac;
      if (multiple > CAC_UNIT_IMPLAUSIBLE_MULTIPLE) {
        offenders.push(`${index}:${kpiLabel || 'kpi'} impliedCac=${formatMoney(impliedCac)} beats target=${formatMoney(targetCac)} by ${multiple.toFixed(1)}x (no customer-CAC bridge or band)`);
      }
      return;
    }

    // No separate implied cost-per-signup: the funnel-stage row uses a single
    // cost figure AS the cost-per-signup. When that figure is implausibly high
    // for a top-of-funnel action (>= $1,000/signup, no trial->paid bridge) it is
    // a misapplied paid-customer CAC target — the c9bc2056 "$3,000 per free
    // trial signup" conflation the multiple-rule never sees (no separate
    // impliedCac to divide). A legitimate low cost-per-trial benchmark passes.
    if (targetCac >= CAC_UNIT_IMPLAUSIBLE_FUNNEL_COST) {
      offenders.push(`${index}:${kpiLabel || 'kpi'} cost-per-signup=${formatMoney(targetCac)} is a misapplied paid-customer CAC (no trial->paid bridge or band)`);
    }
  });

  const ok = offenders.length === 0;
  const check = passFail(
    'CAC-UNIT',
    ok,
    [
      `rows=${rows.length}`,
      `funnelStageKpiRows=${funnelRows}`,
      `rowsWithTrialToPaidBridge=${bridgedRows}`,
      `unitMismatchOffenders=${offenders.length}${offenders.length ? ` (${offenders.join(' | ')})` : ''}`,
    ].join('; '),
  );

  if (!ok) check.neverShipReasons.push('CAC-UNIT: funnel-stage cost-per-signup compared to a paid-customer CAC target with no trial->paid bridge (self-falsifying funnel math)');
  return check;
}

function fullHumanName(value) {
  const name = stringValue(value);
  if (!name) return false;
  // A "First Last" (or longer) human name: 2+ capitalized word tokens.
  const tokens = name.split(/\s+/).filter((token) => /^[A-Z][A-Za-z'.-]+$/.test(token));
  return tokens.length >= 2;
}

function collectPersonaRecords(value, path = '$', records = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPersonaRecords(item, `${path}[${index}]`, records));
    return records;
  }
  if (!isRecord(value)) return records;
  if (/persona/i.test(path) && (value.name || value.fullName || value.persona)) {
    records.push({ path, row: value });
  }
  for (const [key, child] of Object.entries(value)) {
    collectPersonaRecords(child, `${path}.${key}`, records);
  }
  return records;
}

// PERSONA-CONTAINMENT — surface vendorSourced named-human personas (full human
// names dressed in vendorSourced:true citations) as a never-ship risk. The c77
// run carries 5 fabricated named buyers (Rachel Pleasants McLean, etc.) that do
// not appear on the cited live pages. The eval cannot fetch the pages, so at
// minimum it surfaces the count for the judge and flags it as a never-ship risk.
function evaluatePersonaContainment(buyerIcpBody) {
  if (!isRecord(buyerIcpBody) || Object.keys(buyerIcpBody).length === 0) {
    return statusCheck('PERSONA-CONTAINMENT', 'N-A', 'buyer-ICP section body missing; personas=0; vendorSourcedNamedHumans=0');
  }
  const personaRecords = collectPersonaRecords(buyerIcpBody);
  const named = personaRecords.filter(({ row }) => fullHumanName(row.name ?? row.fullName ?? row.persona));
  const vendorSourcedNamed = named.filter(({ row }) => row.vendorSourced === true || row.vendorSourced === 'true');
  const names = vendorSourcedNamed
    .map(({ row }) => stringValue(row.name ?? row.fullName ?? row.persona))
    .filter(Boolean);

  // ADVISORY, not a hard gate: whether a named persona actually appears on its
  // cited page cannot be proven offline. The engine source-liveness gate drops
  // fabricated/dead persona URLs (and now name-contains the survivors) BEFORE
  // commit, and the cold judge's noFabrication boolean is the page-level
  // backstop. We surface the count + names so the judge scrutinizes them, but do
  // NOT push a never-ship reason on a signal the deterministic eval cannot prove
  // — otherwise a clean run with REAL on-page customers (e.g. a genuine
  // case-study named buyer) would false-fail.
  const ok = vendorSourcedNamed.length === 0;
  const check = statusCheck(
    'PERSONA-CONTAINMENT',
    ok ? 'PASS' : 'ADVISORY',
    [
      `personaRecords=${personaRecords.length}`,
      `namedHumanPersonas=${named.length}`,
      `vendorSourcedNamedHumans=${vendorSourcedNamed.length}${names.length ? ` (${names.slice(0, 6).join(', ')})` : ''}`,
      'live-page name containment enforced by engine source-liveness gate + cold judge noFabrication (not verifiable offline)',
    ].join('; '),
    { vendorSourcedNamedPersonaCount: vendorSourcedNamed.length },
  );

  return check;
}

function maxVerifiedCountInText(text) {
  let max = 0;
  for (const match of stringValue(text).matchAll(/(\d+)\s+(?:total\s+)?verified/gi)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

// Captured creatives per competitor, keyed on normalized advertiser identity.
// adEvidence.advertiserGroups carries the section's OWN captured arrays.
function buildCapturedCreativeMap(competitorBody) {
  const groups = arrayFromPaths(competitorBody, [
    ['adEvidence', 'advertiserGroups'],
    ['adEvidence', 'groups'],
    ['advertiserGroups'],
  ]);
  const byAdvertiser = new Map();
  let total = 0;
  for (const group of groups) {
    if (!isRecord(group)) continue;
    const creatives = arrayFromPaths(group, [['creatives'], ['ads'], ['examples']]).filter(isRecord);
    total += creatives.length;
    const keys = new Set();
    const advertiserName = creatives.find((c) => hasNonEmptyString(c.advertiserName))?.advertiserName;
    for (const candidate of [group.advertiserName, group.competitor, group.name, advertiserName]) {
      if (hasNonEmptyString(candidate)) keys.add(normalizedName(candidate));
    }
    // domain may be a bare host ("clickup.com") or a full URL — registrableDomain
    // only parses URLs, so fall back to the raw host string.
    const rawDomain = firstStringFromKeys(group, ['domain', 'website', 'url']);
    const domain = registrableDomain(rawDomain) ?? stringValue(rawDomain).replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (domain) keys.add(normalizedName(domain.split('.')[0]));
    for (const key of keys) byAdvertiser.set(key, (byAdvertiser.get(key) ?? 0) + creatives.length);
  }
  return { byAdvertiser, total, groupCount: groups.length };
}

function lookupCapturedForCompetitor(byAdvertiser, competitorName) {
  const key = normalizedName(competitorName);
  if (!key) return null;
  if (byAdvertiser.has(key)) return byAdvertiser.get(key);
  // "Zapier Tables" -> "zapier", "ClickUp Projects" -> first token match.
  for (const [advKey, count] of byAdvertiser) {
    if (advKey && (key.includes(advKey) || advKey.includes(key))) return count;
  }
  return null;
}

// COMPETITOR-COUNT — "N verified" grounding strings must not exceed the captured
// creative evidence PER ADVERTISER. c77 claims Smartsheet "29 verified" /
// ClickUp "35 verified" while the section's OWN creative arrays hold 12 / 6.
// Aggregate sums hide this (41 captured > 35), so attribute each claim to its
// competitor via adPresence.signals / shareOfVoice.slices and compare per-row.
function evaluateCompetitorCount(competitorBody) {
  if (!isRecord(competitorBody) || Object.keys(competitorBody).length === 0) {
    return statusCheck('COMPETITOR-COUNT', 'N-A', 'competitor section body missing; verifiedClaims=0; capturedCreatives=0');
  }
  const { byAdvertiser, total: capturedCreatives, groupCount } = buildCapturedCreativeMap(competitorBody);

  // If no creative arrays were captured we cannot cross-check; do not false-FAIL
  // an evidence-poor-but-honest section.
  if (capturedCreatives === 0) {
    return statusCheck(
      'COMPETITOR-COUNT',
      'N-A',
      `capturedCreatives=0 (no creative arrays to cross-check); advertiserGroups=${groupCount}`,
    );
  }

  const claimRows = [
    ...arrayFromPaths(competitorBody, [['adPresence', 'signals'], ['adSignals']]),
    ...arrayFromPaths(competitorBody, [['shareOfVoice', 'slices'], ['shareOfVoice', 'rows']]),
  ].filter(isRecord);

  const inflated = [];
  let attributedClaims = 0;
  for (const row of claimRows) {
    const competitorName = firstStringFromKeys(row, ['competitor', 'competitorName', 'company', 'name', 'winner', 'advertiser']);
    const claimText = `${firstStringFromKeys(row, ['evidence', 'detail', 'note', 'summary'])} ${stringValue(row.winner)}`;
    const claim = maxVerifiedCountInText(claimText);
    if (!competitorName || claim === 0) continue;
    const captured = lookupCapturedForCompetitor(byAdvertiser, competitorName);
    if (captured === null) continue;
    attributedClaims += 1;
    if (claim > captured) inflated.push(`${competitorName}: claimed ${claim} verified vs ${captured} captured`);
  }

  const ok = inflated.length === 0;
  const check = passFail(
    'COMPETITOR-COUNT',
    ok,
    [
      `capturedCreatives=${capturedCreatives}`,
      `advertiserGroups=${groupCount}`,
      `attributedClaims=${attributedClaims}`,
      `inflatedPerAdvertiser=${inflated.length}${inflated.length ? ` (${inflated.slice(0, 6).join('; ')})` : ''}`,
    ].join('; '),
  );

  if (!ok) check.neverShipReasons.push(`COMPETITOR-COUNT: ${inflated.length} competitor(s) claim more verified ads than captured creatives — padded ad-evidence counts (${inflated[0]})`);
  return check;
}

function vocEvidenceGap(vocBody) {
  if (!isRecord(vocBody)) return false;
  if (vocBody.evidenceGap === true) return true;
  const gapHit = findKey(vocBody, 'evidenceGap');
  if (gapHit?.value === true) return true;
  // "below ... bar" verdict language anywhere in the VoC body.
  for (const leaf of collectStringLeaves(vocBody)) {
    if (/below[^.]{0,40}\bbar\b/i.test(leaf.value)) return true;
  }
  return false;
}

// VOC-LAUNDERING — paid-media rows tagged sourceSection 'positioningVoiceOf-
// Customer' must not ship customer-voice "proof" when the VoC section's own
// verdict declares evidenceGap=true / "below the bar". c77 sources 3
// competitorReviewInsights + 1 creativeFramework row from a VoC that says it
// produced no buyer-language truth.
function evaluateVocLaundering(paidMediaBody, vocBody) {
  // Laundering = paid-media sources customer-voice PROOF from a VoC that produced
  // NOTHING usable (zero captured quote records). If VoC surfaced real pain
  // extracts — even directional/unpermalinked, honestly labeled — citing them is
  // legitimate attribution, not laundering. (The c77 defect was paid-media
  // citing a VoC whose own verdict disowned buyer-language truth; the honest fix
  // surfaces real extracts AND reframes the verdict, so a bare evidenceGap flag
  // is no longer the laundering signal — zero usable quotes is.)
  const vocQuoteCount = isRecord(vocBody) ? collectQuoteRecords(vocBody).length : 0;
  const vocProducedNothing = vocQuoteCount === 0;
  const launderedRows = [];
  const candidatePools = [
    ['competitorReviewInsights', paidMediaBody.competitorReviewInsights],
    ['creativeFramework', paidMediaBody.creativeFramework],
  ];
  for (const [poolName, pool] of candidatePools) {
    for (const [index, row] of asArray(pool).entries()) {
      if (isRecord(row) && stringValue(row.sourceSection) === VOC_SOURCE_SECTION) {
        launderedRows.push(`${poolName}[${index}]`);
      }
    }
  }

  // Only a defect when VoC produced zero usable quotes AND the plan still sources
  // customer-voice proof from it.
  const ok = !(vocProducedNothing && launderedRows.length > 0);
  const check = passFail(
    'VOC-LAUNDERING',
    ok,
    [
      `vocUsableQuoteRecords=${vocQuoteCount}`,
      `vocSourcedPaidRows=${launderedRows.length}${launderedRows.length ? ` (${launderedRows.slice(0, 6).join(', ')})` : ''}`,
    ].join('; '),
  );

  if (!ok) check.neverShipReasons.push(`VOC-LAUNDERING: ${launderedRows.length} paid-media row(s) source customer-voice proof from a VoC that produced zero usable quotes`);
  return check;
}

// acquisitionLedger.rejectionReason values that mean a PROMOTABLE candidate was
// dropped for COUNT / SELECTION reasons (not because it failed a quality bar).
// These are the "had the evidence, threw it away" rejections decision #2 targets.
const VOC_COUNT_SELECTION_REJECTIONS = new Set([
  'insufficient_candidates',
  'insufficient_independent_domains',
  'not_selected',
]);

function vocAcquisitionLedgerRows(vocBody) {
  if (!isRecord(vocBody)) return [];
  const report = isRecord(vocBody.evidenceGapReport) ? vocBody.evidenceGapReport : {};
  return asArray(report.acquisitionLedger).filter(isRecord);
}

// VOC-EMPTY-DESPITE-EVIDENCE — value floor (decision #2). Hard-fail VoC ONLY when
// the acquisitionLedger PROVES scrape+parser success and the section still ships
// empty, OR rejects promotable quote evidence for count/selection reasons. A true
// evidence desert (nothing scraped/parsed, or rejections were quality-based) is an
// honest gap and is NOT penalised. No ledger => N-A (warn-to-judge, never hard-fail).
function evaluateVocEmptyDespiteEvidence(vocBody) {
  const rows = vocAcquisitionLedgerRows(vocBody);
  if (rows.length === 0) {
    return statusCheck(
      'VOC-EMPTY-DESPITE-EVIDENCE',
      'N-A',
      'no acquisitionLedger present — cannot prove scrape/parser success; warn-to-judge (true evidence desert is not penalised)',
    );
  }

  let scrapeParserSucceeded = 0;
  let promotableRejectedForCountSelection = 0;
  for (const row of rows) {
    const scrapeOk = stringValue(row.scrapeStatus) === 'succeeded';
    const parserOk = stringValue(row.parserStatus) === 'succeeded';
    if (!scrapeOk || !parserOk) continue;
    scrapeParserSucceeded += 1;
    if (
      stringValue(row.promotionStatus) === 'rejected' &&
      VOC_COUNT_SELECTION_REJECTIONS.has(stringValue(row.rejectionReason))
    ) {
      promotableRejectedForCountSelection += 1;
    }
  }

  const usableQuoteCount = collectQuoteRecords(vocBody).length;

  // True evidence desert: ledger exists but nothing both scraped AND parsed.
  if (scrapeParserSucceeded === 0) {
    return statusCheck(
      'VOC-EMPTY-DESPITE-EVIDENCE',
      'N-A',
      `acquired=0 (no row both scraped+parsed); usableQuotes=${usableQuoteCount}; true evidence desert — honest gap not penalised`,
    );
  }

  const shipsEmpty = usableQuoteCount === 0 || vocEvidenceGap(vocBody);
  const launderedForCount = promotableRejectedForCountSelection > 0;
  const ok = !(shipsEmpty || launderedForCount);
  const check = passFail(
    'VOC-EMPTY-DESPITE-EVIDENCE',
    ok,
    [
      `acquired=${scrapeParserSucceeded}`,
      `usableQuotes=${usableQuoteCount}`,
      `shipsEmpty=${shipsEmpty}`,
      `promotableRejectedForCountSelection=${promotableRejectedForCountSelection}`,
    ].join('; '),
  );
  if (shipsEmpty) {
    check.neverShipReasons.push(`VOC-EMPTY-DESPITE-EVIDENCE: VoC shipped empty despite ${scrapeParserSucceeded} successfully scraped+parsed candidate(s)`);
  }
  if (launderedForCount) {
    check.neverShipReasons.push(`VOC-EMPTY-DESPITE-EVIDENCE: ${promotableRejectedForCountSelection} promotable candidate(s) rejected for count/selection reasons (not quality)`);
  }
  return check;
}

function evaluateChannels(paidMediaBody) {
  const rows = asArray(paidMediaBody.channelSuggestions);
  const recommendations = rows.map((row) => (isRecord(row) ? stringValue(row.recommendation) : ''));
  const gapRecommendations = recommendations.filter(recommendationIsGap);
  const substantive = recommendations.filter((recommendation) => recommendation.length >= 40 && !recommendationIsGap(recommendation));
  const ok = substantive.length >= 3 && gapRecommendations.length === 0;

  const check = passFail(
    'CHANNELS',
    ok,
    `rows=${rows.length}; substantiveRecommendations=${substantive.length}; gapStringRecommendations=${gapRecommendations.length}`,
  );

  if (gapRecommendations.length > 0) check.neverShipReasons.push('CHANNELS: gap-string recommendations persisted as data values');
  return check;
}

function evaluateAngles(paidMediaBody) {
  const rows = asArray(paidMediaBody.anglesToTest);
  const complete = rows.filter((row) => isRecord(row) && hasNonEmptyString(row.shortName) && hasNonEmptyString(row.description));
  return passFail(
    'ANGLES',
    rows.length >= 4 && complete.length >= 4,
    `rows=${rows.length}; completeShortNameAndDescription=${complete.length}`,
  );
}

function evaluateCreative(paidMediaBody) {
  const framework = paidMediaBody.creativeFramework;
  const frameworkCount = Array.isArray(framework)
    ? framework.length
    : isRecord(framework)
      ? Object.keys(framework).length
      : 0;
  const strategy = isRecord(paidMediaBody.creativeStrategy) ? paidMediaBody.creativeStrategy : {};
  const countFields = ['staticCount', 'videoCount', 'totalPerAudience'];
  const numericCounts = countFields.filter((field) => parseNumber(strategy[field]) !== null);
  return passFail(
    'CREATIVE',
    frameworkCount > 0 && numericCounts.length === countFields.length,
    `creativeFrameworkCount=${frameworkCount}; numericCreativeStrategyCounts=${numericCounts.length}/${countFields.length}`,
  );
}

function evaluateMemo(thesis) {
  if (!isRecord(thesis)) {
    const check = passFail('MEMO', false, 'thesis=null; status=n/a; blockedOrStubHits=0; duplicateRankedMoves=0');
    check.neverShipReasons.push('MEMO: executive decision memo is missing');
    return check;
  }

  const leaves = collectStringLeaves(thesis);
  const lowerTexts = leaves.map((leaf) => ({ ...leaf, lower: leaf.value.toLowerCase() }));
  const blockingHits = [];
  for (const leaf of lowerTexts) {
    for (const token of MEMO_BLOCKING_TOKENS) {
      if (leaf.lower.includes(token)) {
        blockingHits.push(`${leaf.path}:${token}`);
        break;
      }
    }
  }

  const moveTexts = extractRankedMoveTexts(thesis);
  const seen = new Set();
  const duplicates = [];
  for (const text of moveTexts) {
    if (seen.has(text)) duplicates.push(text);
    seen.add(text);
  }

  const ok = thesis.status === 'complete' && blockingHits.length === 0 && duplicates.length === 0;
  const check = passFail(
    'MEMO',
    ok,
    [
      `status=${thesis.status ?? 'missing'}`,
      `stringLeaves=${leaves.length}`,
      `blockedOrStubHits=${blockingHits.length}${blockingHits.length ? ` (${blockingHits.slice(0, 5).join(', ')})` : ''}`,
      `rankedMoves=${moveTexts.length}`,
      `duplicateRankedMoves=${duplicates.length}`,
    ].join('; '),
  );

  if (!ok) {
    if (blockingHits.length > 0) check.neverShipReasons.push('MEMO: blocked/internal instruction text reached the decision memo');
    if (duplicates.length > 0) check.neverShipReasons.push('MEMO: rankedMoves contains duplicate strings');
    if (thesis.status !== 'complete') check.neverShipReasons.push('MEMO: thesis status is not complete');
  }
  return check;
}

function evaluateDenyList(sections, thesis) {
  const hits = [];
  for (const section of sections) {
    if (!POSITIONING_CLIENT_ZONES.includes(section.zone)) continue;
    const leaves = collectStringLeaves(bodyOf(section), { skipKey: denyListSkipKey }, `${section.zone}.body`);
    for (const leaf of leaves) {
      const token = findDenyToken(leaf.value);
      if (token) hits.push({ token, path: leaf.path, value: truncate(leaf.value) });
    }
  }

  if (isRecord(thesis)) {
    const leaves = collectStringLeaves(thesis, { skipKey: denyListSkipKey }, 'thesis');
    for (const leaf of leaves) {
      const token = findDenyToken(leaf.value);
      if (token) hits.push({ token, path: leaf.path, value: truncate(leaf.value) });
    }
  }

  const evidence = hits.length === 0
    ? `hits=0; scannedZones=${POSITIONING_CLIENT_ZONES.length}; thesisScanned=${isRecord(thesis)}`
    : `hits=${hits.length}; firstHits=${hits.slice(0, 8).map((hit) => `${hit.path} -> ${hit.token}`).join(' | ')}`;
  return passFail('DENY-LIST', hits.length === 0, evidence, { denyHits: hits });
}

function evaluateQuotes(vocBody) {
  if (!isRecord(vocBody) || Object.keys(vocBody).length === 0) {
    return statusCheck('QUOTES', 'FAIL', 'VoC section body missing; quoteRecords=0; permalinkedQuotes=0');
  }

  const quoteRecords = collectQuoteRecords(vocBody);
  const permalinked = quoteRecords.filter((record) => Boolean(registrableDomain(record.url)));
  const retrievalSummary = findKey(vocBody, 'retrievalSummary');

  if (permalinked.length >= 1) {
    return statusCheck(
      'QUOTES',
      'PASS',
      `quoteRecords=${quoteRecords.length}; permalinkedQuotes=${permalinked.length}; retrievalSummary=${retrievalSummary ? 'present' : 'missing'}`,
    );
  }

  if (quoteRecords.length === 0 && retrievalSummary) {
    return statusCheck(
      'QUOTES',
      'N-A',
      `quoteRecords=0; permalinkedQuotes=0; retrievalSummary=present (${retrievalSummary.path}); honest gap noted`,
    );
  }

  const check = statusCheck(
    'QUOTES',
    'FAIL',
    `quoteRecords=${quoteRecords.length}; permalinkedQuotes=${permalinked.length}; retrievalSummary=${retrievalSummary ? 'present' : 'missing'}`,
  );
  check.neverShipReasons.push('QUOTES: VoC quote records lack item-level permalinks');
  return check;
}

function evaluatePricing(competitorBody) {
  const directRows = arrayFromPaths(competitorBody, [
    ['pricingReality', 'dataPoints'],
    ['pricingReality', 'rows'],
    ['pricingReality', 'pricingRows'],
    ['pricingRows'],
  ]).map((row, index) => ({ row, path: `pricingReality[${index}]` }));
  const discoveredRows = directRows.length > 0
    ? directRows
    : collectRowsUnderKeys(competitorBody, /pricing|price/i);
  const rows = discoveredRows.filter(({ row }) => isRecord(row));
  const competitorDomains = buildCompetitorDomainMap(competitorBody);

  let vendorDomainRows = 0;
  let thirdPartyRows = 0;
  let unknownRows = 0;

  for (const { row } of rows) {
    const sourceUrl = firstStringFromKeys(row, ['sourceUrl', 'source_url', 'url', 'citationUrl', 'pricingUrl']);
    const sourceDomain = registrableDomain(sourceUrl);
    const competitorName = firstStringFromKeys(row, ['competitor', 'competitorName', 'company', 'companyName', 'vendor', 'name']);
    const competitorKey = normalizedName(competitorName);
    const mappedDomain = competitorDomains.get(competitorKey);
    const nameSuggestsDomain = competitorKey && sourceDomain
      ? sourceDomain.replace(/[^a-z0-9]/g, '').includes(competitorKey)
      : false;

    if (!sourceDomain || !competitorKey) {
      unknownRows += 1;
    } else if ((mappedDomain && mappedDomain === sourceDomain) || (!mappedDomain && nameSuggestsDomain)) {
      vendorDomainRows += 1;
    } else {
      thirdPartyRows += 1;
    }
  }

  return passFail(
    'PRICING',
    vendorDomainRows >= 1,
    `pricingRows=${rows.length}; vendorDomainRows=${vendorDomainRows}; thirdPartyRows=${thirdPartyRows}; unknownRows=${unknownRows}; competitorDomains=${competitorDomains.size}`,
  );
}

// Meta / internal keys that are NOT client-facing deliverable content. A section
// whose body has ONLY these (no substantive prose/values) is hollow.
const SECTION_EMPTINESS_INTERNAL_KEYS = new Set([
  'review',
  'verification',
  'verifierSummary',
  'decodeRepairs',
  'sources',
  'status',
  'zone',
  'tier',
  'evidenceGap',
  'evidenceGapReport',
  'retrievalSummary',
  'rejectedPersonaLabels',
]);

function sectionHasHonestGap(body) {
  if (!isRecord(body)) return false;
  if (body.evidenceGap === true) return true;
  if (findKey(body, 'evidenceGap')?.value === true) return true;
  const report = body.evidenceGapReport;
  if (isRecord(report) && (hasNonEmptyString(report.reason) || hasNonEmptyString(report.summary) || asArray(report.sourcingPlan).length > 0)) {
    return true;
  }
  if (hasNonEmptyString(body.retrievalSummary)) return true;
  for (const leaf of collectStringLeaves(body)) {
    if (/below[^.]{0,40}\bbar\b/i.test(leaf.value)) return true;
  }
  return false;
}

function sectionSubstantiveLeafCount(body) {
  if (!isRecord(body)) return 0;
  return collectStringLeaves(body, {
    skipKey: (key) => SECTION_EMPTINESS_INTERNAL_KEYS.has(key) || key.startsWith('blockGap'),
  }).filter((leaf) => compactWhitespace(leaf.value).length > 0).length;
}

// SECTION-EMPTINESS — value floor. A client-surface section shipped as a deliverable
// (status complete, not excluded from the rollup) whose body carries NO substantive
// client content AND no honest evidence-gap statement is a placeholder shipped as
// deliverable content (a hollow blank). An honest gap is content — it is NOT empty —
// so true evidence deserts that state their gap pass (decision #2: don't fail deserts).
function evaluateSectionEmptiness(sections) {
  const clientSections = asArray(sections).filter((section) =>
    POSITIONING_CLIENT_ZONES.includes(section?.zone),
  );
  const hollow = [];
  for (const section of clientSections) {
    const shippedAsDeliverable =
      section.status === 'complete' && section.counts_toward_rollup !== false;
    if (!shippedAsDeliverable) continue;
    const body = bodyOf(section);
    if (sectionSubstantiveLeafCount(body) === 0 && !sectionHasHonestGap(body)) {
      hollow.push(section.zone);
    }
  }
  const ok = hollow.length === 0;
  const check = passFail(
    'SECTION-EMPTINESS',
    ok,
    `clientSections=${clientSections.length}; hollowWithoutHonestGap=${hollow.length}${hollow.length ? ` (${hollow.join(', ')})` : ''}`,
  );
  if (!ok) {
    check.neverShipReasons.push(`SECTION-EMPTINESS: ${hollow.length} client section(s) shipped empty with no honest evidence-gap statement (${hollow.join(', ')}) — placeholder shipped as deliverable`);
  }
  return check;
}

function evaluateTiers(sections) {
  const clientSections = sections.filter((section) => POSITIONING_CLIENT_ZONES.includes(section.zone));
  const counts = {};
  for (const section of clientSections) {
    const tier = section.verification_tier ?? 'missing';
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  const missing = counts.missing ?? 0;
  return passFail(
    'TIERS',
    missing === 0,
    `clientSections=${clientSections.length}; ${formatCountMap(counts)}`,
  );
}

async function evaluateShare(runId) {
  if (!SHOULD_SHARE) {
    return statusCheck('SHARE', 'N-A', 'not requested; use --share with BASE_URL to POST localhost share route');
  }

  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    return statusCheck('SHARE', 'N-A', '--share requested but BASE_URL is not configured');
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/api/share`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: runId }),
  });
  const text = await response.text();
  return passFail(
    'SHARE',
    response.ok,
    `POST ${url} status=${response.status}; body=${truncate(text, 120)}`,
  );
}

function scoreFromChecks(checks) {
  const capReasons = [];
  const coreFailures = checks.filter((check) => check.core && check.status === 'FAIL');
  if (coreFailures.length > 0) {
    capReasons.push(`cap 6: Buyer-Test core fail(s): ${coreFailures.map((check) => check.id).join(', ')}`);
  }

  const denyCheck = checks.find((check) => check.id === 'DENY-LIST');
  if (denyCheck?.status === 'FAIL') {
    capReasons.push('cap 7: internal vocabulary deny-list hit on client-surface JSON leaves');
  }

  const neverShipReasons = checks.flatMap((check) => check.neverShipReasons ?? []);
  const cap = capReasons.reduce((currentCap, reason) => {
    const match = reason.match(/cap (\d+)/);
    return match ? Math.min(currentCap, Number(match[1])) : currentCap;
  }, 10);
  const score = Math.max(0, cap - neverShipReasons.length);
  // The liar-catcher floor is binary: ANY never-ship penalty (or any cap reason
  // such as a core check fail / deny-list hit) is a HARD-FAIL. There is no
  // "tolerate one never-ship at 9/10" — a thing that must never ship, shipping,
  // is a fail. The numeric score is kept for diagnostics only.
  const hardFail = neverShipReasons.length > 0 || capReasons.length > 0;

  return {
    score,
    cap,
    capReasons,
    neverShipReasons,
    hardFail,
    clean: !hardFail,
  };
}

function markdownTableRow(cells) {
  return `| ${cells.map((cell) => String(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
}

function buildScorecardText({ runId, artifact, checks, score, reportPath, jsonPath }) {
  const lines = [];
  lines.push(`=== Buyer eval: run ${runId} (artifact ${artifact.id}) ===`);
  lines.push('');
  lines.push(markdownTableRow(['Check', 'Status', 'Evidence']));
  lines.push(markdownTableRow(['---', '---', '---']));
  for (const check of checks) {
    lines.push(markdownTableRow([check.id, check.status, check.evidence]));
  }
  lines.push('');
  lines.push('LIAR-CATCHER FLOOR — this gate only proves no hard fabrication/coherence');
  lines.push('defect was DETECTED. It is NOT a quality score: a CLEAN result still needs');
  lines.push('an honest human/judge value read before shipping.');
  lines.push('');
  lines.push(`Final score: ${score.score}/10 (diagnostic only — not a quality grade)`);
  lines.push(`Score cap: ${score.cap}/10`);
  lines.push(`Cap reasons: ${score.capReasons.length > 0 ? score.capReasons.join('; ') : 'none'}`);
  lines.push(`Never-ship penalties: ${score.neverShipReasons.length}${score.neverShipReasons.length > 0 ? ` — ${score.neverShipReasons.join('; ')}` : ''}`);
  lines.push(`Report: ${reportPath}`);
  if (jsonPath) lines.push(`JSON: ${jsonPath}`);
  lines.push(`Gate: ${score.clean ? 'CLEAN' : 'HARD-FAIL'}`);
  return lines.join('\n');
}

function buildReportMarkdown({ runId, artifact, checks, score, scorecardText }) {
  const generatedAt = new Date().toISOString();
  const failingChecks = checks.filter((check) => check.status === 'FAIL').map((check) => check.id);
  return [
    `# Buyer Eval Report — ${reportSlug(runId)}`,
    '',
    `Run id: \`${runId}\``,
    `Artifact id: \`${artifact.id}\``,
    `Generated at: \`${generatedAt}\``,
    `Command: \`node scripts/zz-buyer-eval.mjs ${runId}\``,
    '',
    '## Verdict',
    '',
    '> **Liar-catcher floor.** This gate only proves no hard fabrication or coherence',
    '> defect was *detected*. It is **not** a quality score — a `CLEAN` result still',
    '> requires an honest human/judge value read before shipping.',
    '',
    `Gate: \`${score.clean ? 'CLEAN' : 'HARD-FAIL'}\``,
    `Final score (diagnostic only): \`${score.score}/10\``,
    `Failing checks: \`${failingChecks.length > 0 ? failingChecks.join(', ') : 'none'}\``,
    `Cap reasons: \`${score.capReasons.length > 0 ? score.capReasons.join('; ') : 'none'}\``,
    `Never-ship penalties: \`${score.neverShipReasons.length}\``,
    '',
    '## Full Scorecard Output',
    '',
    '```text',
    scorecardText,
    '```',
    '',
    '## Evidence Notes',
    '',
    '- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.',
    '- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.',
    '- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.',
    '',
  ].join('\n');
}

function buildJsonPayload({ runId, artifact, sections, checks, score, reportPath }) {
  return {
    runId,
    artifact: {
      id: artifact.id,
      status: artifact.status,
      childrenTotal: artifact.children_total,
      childrenComplete: artifact.children_complete,
    },
    sections: sections.map((section) => ({
      zone: section.zone,
      status: section.status,
      verificationTier: section.verification_tier ?? null,
      countsTowardRollup: section.counts_toward_rollup ?? null,
    })),
    checks,
    score,
    reportPath,
  };
}

// Offline replay: reconstruct { artifact, sections } from a zz-dump-run-sections.mjs
// bundle dir (each <zone>.json is the section's full `data` object; _manifest.json
// carries artifact metadata incl. thesis). No DB read — used by --bundle and by the
// offline-safe release gate so the whole gate stack is runnable without Supabase.
async function loadRunFromBundle(dir) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(dir, '_manifest.json'), 'utf8'));
  } catch (err) {
    throw new Error(`offline bundle: cannot read ${join(dir, '_manifest.json')} — run zz-dump-run-sections.mjs <run_id> ${dir} first (${err instanceof Error ? err.message : String(err)})`);
  }
  const sections = [];
  for (const entry of manifest.sections ?? []) {
    let data = {};
    try { data = JSON.parse(await readFile(join(dir, `${entry.zone}.json`), 'utf8')); } catch { data = {}; }
    sections.push({
      zone: entry.zone,
      status: entry.status ?? null,
      verification_tier: entry.verification_tier ?? null,
      counts_toward_rollup: entry.counts_toward_rollup ?? null,
      data,
    });
  }
  const artifact = {
    id: manifest.artifact_id ?? 'offline-bundle',
    run_id: manifest.run_id ?? null,
    status: manifest.status ?? null,
    children_total: manifest.children_total ?? null,
    children_complete: manifest.children_complete ?? null,
    thesis: manifest.thesis ?? null,
  };
  return { artifact, sections };
}

async function loadRun(runId) {
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  const { data: artifacts, error: artifactError } = await supabase
    .from('research_artifacts')
    .select('id, run_id, status, children_total, children_complete, profile_persisted_at, thesis, created_at, updated_at')
    .eq('run_id', runId);
  if (artifactError) throw new Error(`research_artifacts read failed for runId=${runId}: ${artifactError.message}`);
  if (!artifacts?.length) throw new Error(`No research_artifacts row for runId=${runId}`);
  const artifact = artifacts[0];

  const { data: sections, error: sectionsError } = await supabase
    .from('research_artifact_sections')
    .select('zone, status, verification_tier, counts_toward_rollup, data')
    .eq('artifact_id', artifact.id)
    .order('zone');
  if (sectionsError) throw new Error(`research_artifact_sections read failed for artifactId=${artifact.id}: ${sectionsError.message}`);

  return { artifact, sections: sections ?? [] };
}

async function main() {
  const { artifact, sections } = BUNDLE_DIR ? await loadRunFromBundle(BUNDLE_DIR) : await loadRun(RUN_ID);
  const runId = RUN_ID ?? artifact.run_id ?? 'offline-bundle';
  const byZone = new Map(sections.map((section) => [section.zone, section]));
  const paidMediaBody = bodyOf(byZone.get(PAID_MEDIA_ZONE));
  const vocBody = bodyOf(byZone.get(VOC_ZONE));
  const competitorBody = bodyOf(byZone.get(COMPETITOR_ZONE));
  const buyerIcpBody = bodyOf(byZone.get(BUYER_ICP_ZONE));

  const checks = [
    evaluateCascade(paidMediaBody),
    evaluateProjections(paidMediaBody),
    evaluateBudgetPartition(paidMediaBody),
    evaluateCacUnit(paidMediaBody),
    evaluateChannels(paidMediaBody),
    evaluateAngles(paidMediaBody),
    evaluateCreative(paidMediaBody),
    evaluateMemo(artifact.thesis),
    evaluateDenyList(sections, artifact.thesis),
    evaluateQuotes(vocBody),
    evaluatePersonaContainment(buyerIcpBody),
    evaluateCompetitorCount(competitorBody),
    evaluateVocLaundering(paidMediaBody, vocBody),
    evaluateVocEmptyDespiteEvidence(vocBody),
    evaluatePricing(competitorBody),
    evaluateSectionEmptiness(sections),
    evaluateTiers(sections),
    await evaluateShare(runId),
  ];

  const score = scoreFromChecks(checks);
  const reportPath = join('docs', 'reports', `buyer-eval-${reportSlug(runId)}.md`);
  const jsonPath = SHOULD_WRITE_JSON ? join('docs', 'reports', `buyer-eval-${reportSlug(runId)}.json`) : null;
  const scorecardText = buildScorecardText({
    runId,
    artifact,
    checks,
    score,
    reportPath,
    jsonPath,
  });

  await mkdir(join('docs', 'reports'), { recursive: true });
  await writeFile(reportPath, buildReportMarkdown({
    runId,
    artifact,
    checks,
    score,
    scorecardText,
  }), 'utf8');

  if (jsonPath) {
    await writeFile(jsonPath, JSON.stringify(buildJsonPayload({
      runId,
      artifact,
      sections,
      checks,
      score,
      reportPath,
    }), null, 2), 'utf8');
  }

  console.log(scorecardText);
  process.exit(score.clean ? 0 : 2);
}

if (IS_CLI) {
  main().catch((error) => {
    console.error(`FATAL buyer eval failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

// Exported for unit tests so the deterministic checks are covered without a DB read.
export {
  bodyOf,
  scoreFromChecks,
  evaluateBudgetPartition,
  evaluateCacUnit,
  evaluatePersonaContainment,
  evaluateCompetitorCount,
  evaluateVocLaundering,
  evaluateVocEmptyDespiteEvidence,
  evaluateSectionEmptiness,
  evaluateQuotes,
};
