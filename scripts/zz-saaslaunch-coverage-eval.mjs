#!/usr/bin/env node
// zz-saaslaunch-coverage-eval.mjs — deterministic, read-only SaaSLaunch paid-media
// fulfillment COVERAGE eval. Grades the persisted `positioningPaidMediaPlan`
// ARTIFACT BUNDLE (never the deck UI) against the 13-slide SaaSLaunch template
// used as a coverage rubric. One graded slot per template content slide.
//
// This is COMPLEMENTARY to zz-buyer-eval.mjs, which owns the numeric liar-catchers
// (budget partition, CAC-unit math, competitor counts, VoC laundering, cascade).
// This eval grades fulfillment COVERAGE + honest labeling: hollow slots, template
// residue, bare labels, gap-rows-counted-as-coverage, ungrounded synthesis,
// fabricated sales links, unsourced competitor spend, CAC-unit disambiguation, and
// paid-media reading full while upstream BuyerICP/VoC are insufficient.
//
// ADVISORY. Default exit is always 0 — this is a dev/release proof tool and never
// blocks runtime product UX or makes a user wait. Pass --strict to exit 2 on any
// slot hard-failure (for future promotion into a gate). It is NOT wired into the
// blocking combineReleaseGate path.
//
// Usage:
//   node scripts/zz-saaslaunch-coverage-eval.mjs <run_id> [--json] [--strict]
//   node scripts/zz-saaslaunch-coverage-eval.mjs --bundle <dir> [--json] [--strict]
//
// Read-only against Supabase (SELECT only). --bundle reads a zz-dump-run-sections.mjs
// dump (<zone>.json + _manifest.json) with no DB at all.
//
// Exit 0 = advisory (default) OR --strict clean. Exit 2 = --strict + slot fail(s).
// Exit 1 = setup/DB/load error.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// True only as the process entrypoint; false when imported (e.g. by the unit test
// reusing the pure graders). Keeps the pure functions importable without booting
// the Supabase-reading main().
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

const BUNDLE_DIR = flagValue('--bundle');
const positional = argv.filter((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--bundle');
const RUN_ID = positional[0];
const SHOULD_JSON = flags.has('--json');
const STRICT = flags.has('--strict');

const UNKNOWN_FLAGS = [...flags].filter((flag) => !['--json', '--strict', '--bundle'].includes(flag));
if (IS_CLI && ((!RUN_ID && !BUNDLE_DIR) || UNKNOWN_FLAGS.length > 0)) {
  const unknown = UNKNOWN_FLAGS.length > 0 ? ` Unknown flag(s): ${UNKNOWN_FLAGS.join(', ')}` : '';
  console.error(`Usage: node scripts/zz-saaslaunch-coverage-eval.mjs <run_id> [--json] [--strict] [--bundle <dir>]${unknown}`);
  process.exit(1);
}

const PAID_MEDIA_ZONE = 'positioningPaidMediaPlan';

// The six positioning sections a synthesized paid-media row may legitimately cite.
// gtmBrief = operator input (legal provenance but not research-grounded).
// unattributed = the schema's .catch() fallback for an illegal/missing source.
const RESEARCH_SECTIONS = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
];

// Funnel-stage KPI labels (a free signup, NOT a paid customer). Mirrors the
// buyer-eval pattern; used only for the coverage-honesty CAC-unit advisory.
const FUNNEL_STAGE_KPI_PATTERN = /\b(trial|lead|signup|sign-up|sign up|mql|sql|demo|free)\b/i;

// ---------------------------------------------------------------------------
// Primitive helpers (aligned with zz-buyer-eval.mjs house style).
// ---------------------------------------------------------------------------

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stringValue(value) {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unique(values) {
  return [...new Set(values)];
}

// Mirror of zz-buyer-eval.mjs bodyOf — a section's typed body lives at data.body,
// with a few legacy fallbacks; otherwise the data object itself.
function bodyOf(section) {
  const data = section?.data ?? {};
  if (isRecord(data.body)) return data.body;
  const candidates = [
    data.data,
    data.typedArtifact,
    data.artifact,
    data.paidMediaPlanArtifact,
    data.voiceOfCustomerArtifact,
    data.vocArtifact,
    data.buyerIcpArtifact,
  ];
  for (const candidate of candidates) {
    if (isRecord(candidate?.body)) return candidate.body;
  }
  return isRecord(data) ? data : {};
}

// ---------------------------------------------------------------------------
// Fabrication / hollowness detectors (pure, exported for tests).
// ---------------------------------------------------------------------------

// Template residue: the literal placeholder tokens the SaaSLaunch deck ships with.
// An artifact that echoes any of these has hollow fill, not real content.
const RESIDUE_PATTERNS = [
  /\$\s*\[[^\]]*\]/g, //                              $[Budget], $[ X ]
  /\[\s*x\s*\]/gi, //                                 [X]
  /\[[^\]]*\b(?:budget|platform|months?|industry|primary kpi|definition|angle\s*\d|funnel\s*\d|link to document|audiences?)\b[^\]]*\]/gi,
  /\[[^\]]*\b(?:fill in|list[^\]]*here|short name|one-sentence|how (?:we|they)\b|what'?s broken|direct quote or paraphrased|insert\b|your[^\]]*here|e\.g\.)\b[^\]]*\]/gi,
  /\bfill in (?:specifics|the)\b/gi, //               unbracketed instruction echo
  /\bdirect quote or paraphrased\b/gi,
  /\bshort name\]/gi,
];

function scanResidue(value) {
  const text = stringValue(value);
  if (!text.trim()) return [];
  const hits = [];
  // A field whose ENTIRE value is a single bracket span is a placeholder.
  if (/^\[[^\]]+\]$/.test(text.trim())) hits.push(text.trim());
  for (const pattern of RESIDUE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) hits.push(...matches.map((m) => m.trim()));
  }
  return unique(hits);
}

// Bare structural labels that are valid as a slot's LABEL but never as its CONTENT.
// e.g. a creative `hook` of just "Problem-Solution-Transformation" or "PST 1" is a
// framework name echoed in place of an actual creative idea.
const BARE_LABELS = new Set([
  'problem-solution-transformation',
  'problem solution transformation',
  'problem to solution to transformation',
  'objection handling',
  'objection',
  'usp',
  'demo + objection',
  'demo and objection',
  'before / after',
  'before/after',
  'before after',
  'static ads',
  'static creatives',
  'ugc videos',
  'ugc creatives',
  'broad prospecting',
  'high intent',
  'ai optimized',
  'interest stack',
  'advantage+',
]);

function isBareLabel(value) {
  const normalized = compact(value).toLowerCase().replace(/[.:;]+$/, '');
  if (!normalized) return false;
  if (BARE_LABELS.has(normalized)) return true;
  return /^(?:pst|objection|angle|funnel|audience|phase)\s*\d+$/.test(normalized);
}

// Honest gap phrasing. An honest gap row is GOOD — it is recorded as missing
// coverage, never counted as fulfilled, and never a hard-failure. Aligned with
// zz-buyer-eval.mjs recommendationIsGap plus the paid-media SKILL gap language.
function valueIsGap(value) {
  const lower = compact(value).toLowerCase();
  if (!lower) return false;
  if (
    lower.startsWith('gap:') ||
    lower.startsWith('evidence gap:') ||
    lower.startsWith('[unverified]') ||
    lower.includes('gap-string')
  ) {
    return true;
  }
  if (['unknown', 'n/a', 'none', 'not disclosed', 'not applicable'].includes(lower)) return true;
  return /\b(?:not supplied|did not supply|has not supplied|none (?:found|supplied|available)|no .{0,24}(?:found|available|supplied|disclosed)|to be (?:supplied|uploaded|provided)|client (?:did not|has not)|awaiting|pending upload|what to upload)\b/i.test(
    lower,
  );
}

function rowIsGap(row, gapFields) {
  if (!isRecord(row)) return false;
  const fields = gapFields && gapFields.length ? gapFields : Object.keys(row);
  // Sales-asset gap object: empty url paired with not-supplied note.
  if ('url' in row && 'note' in row && !hasNonEmptyString(row.url) && valueIsGap(row.note)) return true;
  return fields.some((field) => valueIsGap(row[field]));
}

// sourceSection classification: research-grounded (one of six sections),
// operator (gtmBrief), or ungrounded (missing / 'unattributed' / illegal value).
function classifySourceSection(value) {
  const v = compact(value);
  if (!v || v === 'unattributed') return 'ungrounded';
  if (v === 'gtmBrief') return 'operator';
  if (RESEARCH_SECTIONS.includes(v)) return 'research';
  return 'ungrounded';
}

function groundingIsHollow(grounding, sourceSection) {
  if (!hasNonEmptyString(grounding)) return true;
  const text = compact(grounding);
  if (text.length < 12) return true;
  if (scanResidue(text).length > 0) return true;
  if (isBareLabel(text)) return true;
  if (text.toLowerCase() === compact(sourceSection).toLowerCase()) return true;
  return /^(?:see above|same as above|as above|n\/a|none|tbd|todo)$/i.test(text);
}

// Row-level evidence pointer (the deterministic `evidencePack` written upstream).
// A confident synthesized row must cite an actual upstream locator, not just a broad
// sourceSection + free-text grounding. Valid pointer = evidencePack present AND
// status === 'grounded' AND refs.length >= 1 AND every ref carries non-empty
// sourceSection, evidenceKind, locator, AND excerpt.
function evidencePackIsGrounded(row) {
  if (!isRecord(row)) return false;
  const pack = row.evidencePack;
  if (!isRecord(pack)) return false;
  if (compact(pack.status) !== 'grounded') return false;
  const refs = asArray(pack.refs);
  if (refs.length < 1) return false;
  return refs.every(
    (ref) =>
      isRecord(ref) &&
      hasNonEmptyString(ref.sourceSection) &&
      hasNonEmptyString(ref.evidenceKind) &&
      hasNonEmptyString(ref.locator) &&
      hasNonEmptyString(ref.excerpt),
  );
}

// Resolve a paid-media-evidence-pack locator against a cited upstream section body.
// The builder (src/lib/lab-engine/agents/paid-media-evidence-pack.ts) emits stable
// locators in a dotted + bracket-indexed grammar, ALL rooted at the section body:
//   body.personaReality.personas[0]
//   body.buyingContext.triggers[1]
//   body.competitorSet.competitors[2]
//   body.painLanguage.quotes[0]
//   body.<topKey>[index]            (generic top-level array of records)
//   body.<topKey>.<childKey>[index] (generic one-level-nested array of records)
// Every leaf the builder cites is a RECORD row (it only ever points at an object it
// sliced an excerpt from), so a locator that lands on a non-record (e.g. an array,
// a primitive, or nothing) is treated as UNRESOLVED. Returns the resolved record, or
// undefined when any segment / index is absent. Tolerant of a missing leading `body.`.
function resolveLocator(sectionBody, locator) {
  if (!isRecord(sectionBody)) return undefined;
  const raw = compact(locator);
  if (!raw) return undefined;
  const path = raw.startsWith('body.') ? raw.slice('body.'.length) : raw === 'body' ? '' : raw;
  if (!path) return undefined;

  let node = sectionBody;
  // Split on dots into segments; each segment is `key` optionally followed by `[N]...`.
  for (const segment of path.split('.')) {
    const keyMatch = /^([^[\]]+)((?:\[\d+\])*)$/.exec(segment);
    if (!keyMatch) return undefined;
    const [, key, indices] = keyMatch;
    if (!isRecord(node)) return undefined;
    node = node[key];
    if (indices) {
      for (const idx of indices.match(/\d+/g) ?? []) {
        if (!Array.isArray(node)) return undefined;
        node = node[Number(idx)];
        if (node === undefined) return undefined;
      }
    }
  }
  return isRecord(node) ? node : undefined;
}

// A grounded pack's refs cite real upstream rows. For each ref whose cited section
// body is PRESENT in the run (passed in `committedBodies` keyed by zone), the ref's
// locator MUST resolve to a real node in that body — otherwise it is a fabricated
// pointer. Refs whose cited section is ABSENT from the run are intentionally skipped
// here: that case is owned by the existing missing-upstream laundering check and must
// not be relabeled as fabrication. Returns the list of unresolved (sourceSection,
// locator) refs against PRESENT bodies; empty list = no fabricated pointer.
function unresolvedEvidenceRefs(row, committedBodies) {
  if (!isRecord(row)) return [];
  const pack = row.evidencePack;
  if (!isRecord(pack)) return [];
  const bodies = committedBodies instanceof Map ? committedBodies : new Map();
  const out = [];
  for (const ref of asArray(pack.refs)) {
    if (!isRecord(ref)) continue;
    const refSection = compact(ref.sourceSection);
    const locator = compact(ref.locator);
    if (!refSection || !locator) continue;
    const upstreamBody = bodies.get(refSection);
    // Section absent from the run -> defer to missing-upstream laundering, do not flag.
    if (!isRecord(upstreamBody)) continue;
    if (!resolveLocator(upstreamBody, locator)) {
      out.push({ sourceSection: refSection, locator });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Upstream sufficiency (cross-slot): a synthesized slot cannot honestly read
// "full" on grounding that points at an insufficient/empty upstream section.
// ---------------------------------------------------------------------------

function collectQuoteRecords(value, records = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectQuoteRecords(item, records);
  } else if (isRecord(value)) {
    // Real VoC quote rows hold their text in `verbatimText` (pain/success) or
    // `evidenceQuote` (decision criteria), not `quote`/`verbatim`/`text` — recognize all.
    if (
      hasNonEmptyString(value.quote) ||
      hasNonEmptyString(value.verbatim) ||
      hasNonEmptyString(value.verbatimText) ||
      hasNonEmptyString(value.evidenceQuote) ||
      hasNonEmptyString(value.text)
    ) {
      records.push(value);
    }
    for (const key of Object.keys(value)) collectQuoteRecords(value[key], records);
  }
  return records;
}

function vocUsableQuoteCount(body) {
  return isRecord(body) ? collectQuoteRecords(body).length : 0;
}

function buyerIcpGroundedCount(body) {
  if (!isRecord(body)) return 0;
  // Real buyer-icp bodies nest pools under typed blocks (personaReality.personas,
  // buyingContext.triggers, icpExistenceCheck.firmographicCuts, clusters.venues); the
  // flat keys are legacy/test shapes. Read both so a genuinely-grounded section is not
  // falsely flagged insufficient.
  const pools = [
    body.personas,
    body.personaReality?.personas,
    body.buyingTriggers,
    body.triggers,
    body.buyingContext?.triggers,
    body.firmographicCuts,
    body.firmographics,
    body.icpExistenceCheck?.firmographicCuts,
    body.venues,
    body.clusters?.venues,
  ];
  let count = 0;
  for (const pool of pools) {
    for (const row of asArray(pool)) {
      if (isRecord(row) && !rowIsGap(row, Object.keys(row))) count += 1;
      else if (hasNonEmptyString(row) && !valueIsGap(row)) count += 1;
    }
  }
  return count;
}

// Acquisition sufficiency self-report (Wave 2): a section may attach
// body.evidenceGapReport.sufficiency = { tier, rationale, candidatesFound, promoted,
// rejected }. This is read as an ADDITIONAL insufficiency trip-wire only — a section
// that reports tier 'insufficient' is insufficient even if the heuristics below would
// miss it. A self-reported 'sufficient' is NOT trusted to clear a real gap: this helper
// never returns a value that lets a section talk its way out of the floors below.
function acquisitionSufficiencyTier(body) {
  const report = isRecord(body) ? body.evidenceGapReport : undefined;
  const sufficiency = isRecord(report) ? report.sufficiency : undefined;
  return isRecord(sufficiency) ? compact(sufficiency.tier).toLowerCase() : '';
}

function sectionIsInsufficient(section) {
  if (!section) return false;
  const tier = compact(section.verification_tier).toLowerCase();
  if (tier === 'insufficient') return true;
  const reviewTier = compact(section.reviewTier ?? section?.data?.review?.tier).toLowerCase();
  if (reviewTier === 'insufficient') return true;
  const body = bodyOf(section);
  if (isRecord(body) && body.evidenceGap === true) return true;
  if (acquisitionSufficiencyTier(body) === 'insufficient') return true;
  if (section.zone === 'positioningVoiceOfCustomer') return vocUsableQuoteCount(body) === 0;
  if (section.zone === 'positioningBuyerICP') return buyerIcpGroundedCount(body) === 0;
  return false;
}

// ---------------------------------------------------------------------------
// Slot specs — the 12 SaaSLaunch template content slides mapped to body keys.
// ---------------------------------------------------------------------------

const SLOT_SPECS = [
  {
    slot: 'Campaign Overview',
    key: 'campaignOverview',
    tag: 'templated',
    kind: 'object',
    textFields: ['prose', 'platform', 'monthlyBudget', 'dailySpend', 'primaryKpi'],
  },
  {
    slot: 'Campaign Phases',
    key: 'campaignPhases',
    tag: 'templated',
    kind: 'array',
    min: 1,
    textFields: ['phaseName', 'monthsLabel', 'monthlyBudget'],
    bulletsField: 'bullets',
  },
  {
    slot: 'Audience Types',
    key: 'audienceTypes',
    tag: 'synthesized',
    kind: 'array',
    min: 1,
    textFields: ['archetype', 'detail'],
    contentFields: ['detail'],
    gapFields: ['detail', 'grounding'],
    grounded: { sourceSectionField: 'sourceSection', groundingField: 'grounding' },
  },
  {
    slot: 'Angles to Test',
    key: 'anglesToTest',
    tag: 'synthesized',
    kind: 'array',
    min: 2,
    textFields: ['shortName', 'description'],
    contentFields: ['description'],
    gapFields: ['description', 'grounding'],
    grounded: { sourceSectionField: 'sourceSection', groundingField: 'grounding' },
  },
  {
    slot: 'Creative Strategy',
    key: 'creativeStrategy',
    tag: 'templated',
    kind: 'object',
    textFields: ['prose'],
  },
  {
    slot: 'Creative Framework',
    key: 'creativeFramework',
    tag: 'synthesized',
    kind: 'array',
    min: 3,
    textFields: ['label', 'hook', 'executesAngle'],
    contentFields: ['hook'],
    gapFields: ['hook', 'grounding'],
    grounded: { sourceSectionField: 'sourceSection', groundingField: 'grounding' },
  },
  {
    slot: 'Funnel Ideation',
    key: 'funnelIdeation',
    tag: 'templated',
    kind: 'array',
    min: 1,
    textFields: ['name', 'description', 'whatItProves'],
    contentFields: ['description', 'whatItProves'],
    gapFields: ['description', 'whatItProves'],
  },
  {
    slot: 'Sales Process',
    key: 'salesProcess',
    tag: 'static_asset',
    kind: 'array',
    min: 1,
    textFields: ['label', 'note'],
    gapFields: ['note', 'url'],
  },
  {
    slot: 'Competitor Insights - Marketing',
    key: 'competitorMarketingInsights',
    tag: 'synthesized',
    kind: 'array',
    min: 2,
    textFields: ['competitor', 'messaging', 'icp', 'angles', 'positioning', 'offer'],
    gapFields: ['messaging', 'grounding'],
    grounded: { sourceSectionField: 'sourceSection', groundingField: 'grounding' },
  },
  {
    slot: 'Competitor Insights - Reviews',
    key: 'competitorReviewInsights',
    tag: 'synthesized',
    kind: 'array',
    exactly: 3,
    textFields: ['complaint', 'howWeLeverage'],
    contentFields: ['complaint'],
    gapFields: ['complaint', 'grounding'],
    grounded: { sourceSectionField: 'sourceSection', groundingField: 'grounding' },
  },
  {
    slot: 'Current Funnel / Channel Suggestions',
    key: 'channelSuggestions',
    tag: 'synthesized',
    kind: 'array',
    min: 1,
    textFields: ['channel', 'recommendation'],
    contentFields: ['recommendation'],
    gapFields: ['recommendation'],
    grounded: { sourceSectionField: 'sourceSection' },
  },
  {
    slot: 'KPIs & Success Metrics',
    key: 'kpis',
    tag: 'templated',
    kind: 'array',
    min: 2,
    textFields: ['metric', 'definition'],
    contentFields: ['definition'],
    gapFields: ['definition'],
  },
];

// ---------------------------------------------------------------------------
// Grading.
// ---------------------------------------------------------------------------

function finalizeSlot(result) {
  result.sourceSections = unique(result.sourceSections);
  if (result.hardFailures.length > 0) result.status = 'fail';
  else if (result.missing.length > 0) result.status = 'warn';
  else result.status = 'pass';
  return result;
}

function gradeObjectFields(spec, obj, base, result) {
  for (const field of spec.textFields) {
    const value = obj[field];
    if (!hasNonEmptyString(value)) {
      result.missing.push(`${base}.${field} empty`);
      continue;
    }
    const residue = scanResidue(value);
    if (residue.length) {
      result.hardFailures.push(`${base}.${field}: template residue ${JSON.stringify(residue.slice(0, 2))}`);
      continue;
    }
    result.evidencePaths.push(`${base}.${field}`);
  }
}

function gradeRowFields(spec, row, rb, result, insufficientUpstreams, missingUpstreams = new Set(), committedBodies = new Map()) {
  let substantive = false;
  for (const field of spec.textFields) {
    const value = row[field];
    if (!hasNonEmptyString(value)) {
      result.missing.push(`${rb}.${field} empty`);
      continue;
    }
    const residue = scanResidue(value);
    if (residue.length) {
      result.hardFailures.push(`${rb}.${field}: template residue ${JSON.stringify(residue.slice(0, 2))}`);
      continue;
    }
    if ((spec.contentFields ?? []).includes(field) && isBareLabel(value)) {
      result.hardFailures.push(`${rb}.${field}: bare label "${compact(value)}" with no content`);
      continue;
    }
    result.evidencePaths.push(`${rb}.${field}`);
    substantive = true;
  }

  if (spec.bulletsField) {
    const bullets = asArray(row[spec.bulletsField]).filter(hasNonEmptyString);
    const residueBullets = bullets.flatMap((b) => scanResidue(b));
    if (bullets.length === 0) result.missing.push(`${rb}.${spec.bulletsField} empty`);
    else if (residueBullets.length) result.hardFailures.push(`${rb}.${spec.bulletsField}: template residue ${JSON.stringify(residueBullets.slice(0, 2))}`);
    else result.evidencePaths.push(`${rb}.${spec.bulletsField}`);
  }

  if (spec.grounded) {
    const ss = stringValue(row[spec.grounded.sourceSectionField]);
    const cls = classifySourceSection(ss);
    if (cls === 'ungrounded') {
      result.hardFailures.push(`${rb}: ungrounded synthesized row (sourceSection=${compact(ss) || '<missing>'})`);
    } else {
      result.sourceSections.push(compact(ss));
      if (cls === 'operator') result.missing.push(`${rb}: operator-attributed (gtmBrief), not research-grounded`);
      const ssKey = compact(ss);
      if (insufficientUpstreams.has(ssKey)) {
        result.hardFailures.push(`${rb}: laundering — cites ${ssKey} which is insufficient/empty upstream`);
      } else if (missingUpstreams.has(ssKey)) {
        result.hardFailures.push(`${rb}: laundering — cites ${ssKey} which is missing from this run (upstream section not present)`);
      }
    }
    if (spec.grounded.groundingField) {
      const grounding = row[spec.grounded.groundingField];
      if (groundingIsHollow(grounding, ss)) result.hardFailures.push(`${rb}.${spec.grounded.groundingField}: hollow/absent grounding`);
      else result.evidencePaths.push(`${rb}.${spec.grounded.groundingField}`);
    }
    // Row-level evidence pointer requirement. Honest gaps already returned earlier
    // (missing/warn) and never reach here; operator/gtmBrief rows already warn and
    // ungrounded rows already hard-fail. Only a research-grounded substantive row must
    // additionally carry a valid `evidencePack` — a broad sourceSection alone is not proof.
    if (cls === 'research') {
      const ssKey = compact(ss);
      if (!evidencePackIsGrounded(row)) {
        result.hardFailures.push(
          `${rb}: synthesized row cites ${ssKey} but carries no row-level evidence pointer (broad sourceSection alone is not proof)`,
        );
      } else {
        // The pack is structurally grounded (non-empty locator/excerpt). Now confirm
        // each locator actually RESOLVES to a real node in the cited upstream body that
        // IS present in the run — a non-resolving locator is a fabricated pointer. Refs
        // citing an ABSENT section are skipped here (owned by missing-upstream above).
        const unresolved = unresolvedEvidenceRefs(row, committedBodies);
        if (unresolved.length > 0) {
          const [first] = unresolved;
          result.hardFailures.push(
            `${rb}: evidence locator does not resolve to cited upstream row (${first.sourceSection} locator="${first.locator}" not found in committed body)`,
          );
        } else {
          result.evidencePaths.push(`${rb}.evidencePack`);
        }
      }
    }
  }
  return substantive;
}

// Sales Process (static_asset): SaaSLaunch standard assets or operator-supplied
// assets or ONE honest gap object. Never invented URLs (paid-media SKILL Iron Law).
const SALES_PROVENANCE = /\b(suppli|provid|client|operator|loom|saaslaunch|walkthrough|standard|uploaded|onboarding)\b/i;
function gradeSalesProcessLinks(rows, base, result) {
  rows.forEach((row, index) => {
    if (!isRecord(row)) return;
    const rb = `${base}[${index}]`;
    const url = stringValue(row.url);
    const note = stringValue(row.note);
    if (scanResidue(url).length) {
      result.hardFailures.push(`${rb}.url: fabricated/placeholder sales-process link "${compact(url)}"`);
      return;
    }
    if (hasNonEmptyString(url) && /^https?:\/\//i.test(url.trim()) && !SALES_PROVENANCE.test(`${note} ${stringValue(row.assetType)} ${stringValue(row.label)}`)) {
      result.missing.push(`${rb}: ADVISORY unverifiable sales-process link (no supply/standard provenance in note)`);
    }
  });
}

// Competitor marketing: an ad-platform/spend CLAIM must carry a real source or an
// explicit unknown. A dollar figure with model-estimated/empty provenance is a
// fabricated spend claim.
const SPEND_SOURCED = /\b(source-reported|tool-measured|ad library|ad-library|spyfu|semrush|similarweb|foreplay)\b/i;
const SPEND_UNKNOWN = /\b(unknown|not disclosed|undisclosed|n\/a|if known|not available)\b/i;
function gradeCompetitorSpend(rows, base, result) {
  rows.forEach((row, index) => {
    if (!isRecord(row)) return;
    const rb = `${base}[${index}]`;
    const adPlatforms = stringValue(row.adPlatforms);
    const provenance = stringValue(row.estSpendProvenance);
    const claimsSpend = /\$\s?\d/.test(adPlatforms) || /\b(spend|budget|\/mo|per month|monthly)\b/i.test(adPlatforms);
    if (!claimsSpend) return;
    if (SPEND_SOURCED.test(provenance) || SPEND_UNKNOWN.test(`${provenance} ${adPlatforms}`)) return;
    result.hardFailures.push(`${rb}: competitor spend/platform claim without source or explicit unknown (estSpendProvenance="${compact(provenance) || '<empty>'}")`);
  });
}

// KPIs slot also inspects projectedResults for CAC-unit honesty: a funnel-stage
// KPI carrying an implied/customer CAC must label the unit (costPerTrialLabel).
// COVERAGE-honesty advisory only — zz-buyer-eval.mjs owns the hard CAC-UNIT floor.
function gradeKpiCacHonesty(projectedResults, base, result) {
  asArray(projectedResults).forEach((row, index) => {
    if (!isRecord(row)) return;
    const kpi = stringValue(row.kpi);
    const carriesCac = row.impliedCacValue != null || row.customerCacValue != null;
    if (FUNNEL_STAGE_KPI_PATTERN.test(kpi) && carriesCac && !hasNonEmptyString(row.costPerTrialLabel)) {
      result.missing.push(`${base.replace('.kpis', '.projectedResults')}[${index}]: ADVISORY funnel-stage KPI carries a CAC without costPerTrialLabel (unit not disambiguated) — buyer-eval owns the hard CAC-UNIT floor`);
    }
  });
}

function gradeSlot(spec, body, ctx = {}) {
  const insufficientUpstreams = ctx.insufficientUpstreams ?? new Set();
  const missingUpstreams = ctx.missingUpstreams ?? new Set();
  const committedBodies = ctx.committedBodies ?? new Map();
  const base = `${PAID_MEDIA_ZONE}.body.${spec.key}`;
  const result = {
    slot: spec.slot,
    tag: spec.tag,
    status: 'pass',
    evidencePaths: [],
    sourceSections: [],
    missing: [],
    hardFailures: [],
  };
  const raw = body?.[spec.key];

  if (spec.kind === 'object') {
    if (!isRecord(raw)) {
      result.hardFailures.push(`${spec.slot}: slot absent from artifact body`);
      result.missing.push(`${spec.key} absent`);
    } else {
      gradeObjectFields(spec, raw, base, result);
      if (spec.key === 'kpis') gradeKpiCacHonesty(ctx.projectedResults, base, result);
    }
    return finalizeSlot(result);
  }

  const rows = asArray(raw);
  if (rows.length === 0) {
    result.hardFailures.push(`${spec.slot}: no rows (slot empty)`);
    result.missing.push(`${spec.key}: 0 rows`);
    return finalizeSlot(result);
  }

  let filled = 0;
  rows.forEach((row, index) => {
    const rb = `${base}[${index}]`;
    if (!isRecord(row)) {
      result.hardFailures.push(`${rb}: malformed row`);
      return;
    }
    if (rowIsGap(row, spec.gapFields)) {
      result.missing.push(`${rb}: honest gap (not counted as coverage)`);
      return;
    }
    if (gradeRowFields(spec, row, rb, result, insufficientUpstreams, missingUpstreams, committedBodies)) filled += 1;
  });

  if (spec.exactly !== undefined && filled !== spec.exactly) {
    result.missing.push(`${spec.key}: expected EXACTLY ${spec.exactly} substantive rows, found ${filled}`);
  } else if (spec.min !== undefined && filled < spec.min) {
    result.missing.push(`${spec.key}: expected >= ${spec.min} substantive rows, found ${filled}`);
  }

  if (spec.key === 'salesProcess') gradeSalesProcessLinks(rows, base, result);
  if (spec.key === 'competitorMarketingInsights') gradeCompetitorSpend(rows, base, result);
  if (spec.key === 'kpis') gradeKpiCacHonesty(ctx.projectedResults, base, result);

  return finalizeSlot(result);
}

function summarize(slots, insufficientUpstreams = new Set(), missingUpstreams = new Set()) {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const slot of slots) counts[slot.status] += 1;
  return {
    total: slots.length,
    pass: counts.pass,
    warn: counts.warn,
    fail: counts.fail,
    clean: counts.fail === 0,
    failedSlots: slots.filter((s) => s.status === 'fail').map((s) => s.slot),
    insufficientUpstreams: [...insufficientUpstreams],
    missingUpstreams: [...missingUpstreams],
  };
}

function gradeCoverage(sections) {
  const byZone = new Map(asArray(sections).map((section) => [section.zone, section]));
  const paidMediaBody = bodyOf(byZone.get(PAID_MEDIA_ZONE));
  const insufficientUpstreams = new Set();
  const missingUpstreams = new Set();
  // Bodies of research sections that ARE present in the run, keyed by zone. Used to
  // resolve each grounded evidence-pack locator against its cited upstream body.
  // Absent sections are deliberately omitted (their laundering is owned by the
  // missing-upstream check; a missing body must not become a fabrication failure).
  const committedBodies = new Map();
  for (const zone of RESEARCH_SECTIONS) {
    // A research section absent from the run entirely is "missing"; a section that is
    // present but empty/low-tier is "insufficient". Both make a synthesized row that
    // cites them a laundering hard-failure (checked per-row in gradeRowFields), but we
    // track them separately so the scorecard reports each honestly. Without this, an
    // offline bundle that simply OMITS a cited upstream section dodged the laundering
    // check (sectionIsInsufficient(undefined) === false).
    if (!byZone.has(zone)) {
      missingUpstreams.add(zone);
    } else {
      const section = byZone.get(zone);
      if (sectionIsInsufficient(section)) insufficientUpstreams.add(zone);
      const body = bodyOf(section);
      if (isRecord(body)) committedBodies.set(zone, body);
    }
  }
  const ctx = {
    insufficientUpstreams,
    missingUpstreams,
    committedBodies,
    projectedResults: asArray(paidMediaBody?.projectedResults),
  };
  const slots = SLOT_SPECS.map((spec) => gradeSlot(spec, paidMediaBody, ctx));
  return { slots, summary: summarize(slots, insufficientUpstreams, missingUpstreams) };
}

// ---------------------------------------------------------------------------
// Loaders (read-only). --bundle mirrors zz-dump-run-sections.mjs output.
// ---------------------------------------------------------------------------

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required but was not configured`);
  return value;
}

async function loadRunFromBundle(dir) {
  const manifest = JSON.parse(await readFile(join(dir, '_manifest.json'), 'utf8'));
  const sections = [];
  for (const entry of asArray(manifest.sections)) {
    let data = {};
    try {
      data = JSON.parse(await readFile(join(dir, `${entry.zone}.json`), 'utf8'));
    } catch {
      data = {};
    }
    sections.push({
      zone: entry.zone,
      status: entry.status ?? null,
      verification_tier: entry.verification_tier ?? null,
      counts_toward_rollup: entry.counts_toward_rollup ?? null,
      reviewTier: entry.reviewTier ?? null,
      data,
    });
  }
  const artifact = {
    id: manifest.artifact_id ?? 'offline-bundle',
    run_id: manifest.run_id ?? null,
    status: manifest.status ?? null,
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
    .select('id, run_id, status, children_total, children_complete')
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

// ---------------------------------------------------------------------------
// Reporting.
// ---------------------------------------------------------------------------

const STATUS_GLYPH = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };
function line() {
  return '═'.repeat(78);
}

function buildScorecard({ runId, slots, summary, strict }) {
  const out = [];
  out.push('');
  out.push(line());
  out.push(`  SAASLAUNCH COVERAGE EVAL — run ${runId ?? 'offline-bundle'}  ·  ADVISORY (not a release blocker)`);
  out.push(line());
  for (const slot of slots) {
    out.push(
      `  [${STATUS_GLYPH[slot.status]}] ${slot.slot.padEnd(38)} ${slot.tag.padEnd(12)} hard=${slot.hardFailures.length} gaps=${slot.missing.length}${slot.sourceSections.length ? `  src=${slot.sourceSections.join(',')}` : ''}`,
    );
    for (const failure of slot.hardFailures) out.push(`        ✗ ${failure}`);
    for (const miss of slot.missing.slice(0, 4)) out.push(`        · ${miss}`);
  }
  out.push(line());
  out.push(`  SLOTS ${summary.pass} pass · ${summary.warn} warn · ${summary.fail} fail (of ${summary.total})`);
  if (summary.insufficientUpstreams.length) out.push(`  Insufficient upstream sections: ${summary.insufficientUpstreams.join(', ')}`);
  if (summary.missingUpstreams?.length) out.push(`  Missing upstream sections (absent from run): ${summary.missingUpstreams.join(', ')}`);
  if (summary.failedSlots.length) out.push(`  Hard-failing slots: ${summary.failedSlots.join(', ')}`);
  out.push(`  ${strict ? (summary.clean ? 'STRICT: clean (exit 0)' : 'STRICT: hard-failure(s) (exit 2)') : 'ADVISORY: exit 0 regardless — pass --strict to gate'}`);
  out.push(line());
  return out.join('\n');
}

async function main() {
  const { artifact, sections } = BUNDLE_DIR ? await loadRunFromBundle(BUNDLE_DIR) : await loadRun(RUN_ID);
  const runId = RUN_ID ?? artifact.run_id ?? 'offline-bundle';
  const { slots, summary } = gradeCoverage(sections);

  if (SHOULD_JSON) {
    console.log(JSON.stringify({ runId, summary, slots }, null, 2));
  } else {
    console.log(buildScorecard({ runId, slots, summary, strict: STRICT }));
  }

  process.exit(STRICT && !summary.clean ? 2 : 0);
}

if (IS_CLI) {
  main().catch((error) => {
    console.error(`FATAL saaslaunch coverage eval failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

// Exported for unit tests so the deterministic coverage graders run with no DB read.
export {
  bodyOf,
  scanResidue,
  isBareLabel,
  valueIsGap,
  rowIsGap,
  classifySourceSection,
  groundingIsHollow,
  evidencePackIsGrounded,
  resolveLocator,
  sectionIsInsufficient,
  acquisitionSufficiencyTier,
  vocUsableQuoteCount,
  buyerIcpGroundedCount,
  gradeSlot,
  gradeCoverage,
  summarize,
  SLOT_SPECS,
};
