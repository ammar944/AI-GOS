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

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
const positional = argv.filter((arg) => !arg.startsWith('--'));
const RUN_ID = positional[0];

const UNKNOWN_FLAGS = [...flags].filter((flag) => !['--json', '--share'].includes(flag));
if (!RUN_ID || UNKNOWN_FLAGS.length > 0) {
  const unknown = UNKNOWN_FLAGS.length > 0 ? ` Unknown flag(s): ${UNKNOWN_FLAGS.join(', ')}` : '';
  console.error(`Usage: node scripts/zz-buyer-eval.mjs <run_id> [--json] [--share]${unknown}`);
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

const CORE_CHECK_IDS = new Set(['CASCADE', 'PROJECTIONS', 'CHANNELS', 'ANGLES']);
const ALLOWED_KPI_COST_PROVENANCE = new Set([
  'user-supplied',
  'tool-measured',
  'source-reported',
  'derived',
]);

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
  const quoteText = firstStringFromKeys(value, ['quote', 'verbatim', 'text', 'value']);
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

  return {
    score,
    cap,
    capReasons,
    neverShipReasons,
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
  lines.push(`Final score: ${score.score}/10`);
  lines.push(`Score cap: ${score.cap}/10`);
  lines.push(`Cap reasons: ${score.capReasons.length > 0 ? score.capReasons.join('; ') : 'none'}`);
  lines.push(`Never-ship penalties: ${score.neverShipReasons.length}${score.neverShipReasons.length > 0 ? ` — ${score.neverShipReasons.join('; ')}` : ''}`);
  lines.push(`Report: ${reportPath}`);
  if (jsonPath) lines.push(`JSON: ${jsonPath}`);
  lines.push(`Gate: ${score.score >= 9 ? 'PASS' : 'FAIL'}`);
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
    `Final score: \`${score.score}/10\``,
    `Gate: \`${score.score >= 9 ? 'PASS' : 'FAIL'}\``,
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
  const { artifact, sections } = await loadRun(RUN_ID);
  const byZone = new Map(sections.map((section) => [section.zone, section]));
  const paidMediaBody = bodyOf(byZone.get(PAID_MEDIA_ZONE));
  const vocBody = bodyOf(byZone.get(VOC_ZONE));
  const competitorBody = bodyOf(byZone.get(COMPETITOR_ZONE));

  const checks = [
    evaluateCascade(paidMediaBody),
    evaluateProjections(paidMediaBody),
    evaluateChannels(paidMediaBody),
    evaluateAngles(paidMediaBody),
    evaluateCreative(paidMediaBody),
    evaluateMemo(artifact.thesis),
    evaluateDenyList(sections, artifact.thesis),
    evaluateQuotes(vocBody),
    evaluatePricing(competitorBody),
    evaluateTiers(sections),
    await evaluateShare(RUN_ID),
  ];

  const score = scoreFromChecks(checks);
  const reportPath = join('docs', 'reports', `buyer-eval-${reportSlug(RUN_ID)}.md`);
  const jsonPath = SHOULD_WRITE_JSON ? join('docs', 'reports', `buyer-eval-${reportSlug(RUN_ID)}.json`) : null;
  const scorecardText = buildScorecardText({
    runId: RUN_ID,
    artifact,
    checks,
    score,
    reportPath,
    jsonPath,
  });

  await mkdir(join('docs', 'reports'), { recursive: true });
  await writeFile(reportPath, buildReportMarkdown({
    runId: RUN_ID,
    artifact,
    checks,
    score,
    scorecardText,
  }), 'utf8');

  if (jsonPath) {
    await writeFile(jsonPath, JSON.stringify(buildJsonPayload({
      runId: RUN_ID,
      artifact,
      sections,
      checks,
      score,
      reportPath,
    }), null, 2), 'utf8');
  }

  console.log(scorecardText);
  process.exit(score.score >= 9 ? 0 : 2);
}

main().catch((error) => {
  console.error(`FATAL buyer eval failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
