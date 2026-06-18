// Numeric coherence gate (post-E2E 8081e646 cold-judge fixes, coherence pack):
// the judge's anchor finding was prose contradicting the artifact's own tables
// — "~5,900 searches/month" narrated in keywordDemand.prose while the keyword
// rows sum to ~7,300, "six of twelve pain quotes" claimed over a quote table
// that backs no such count. Same posture as ADR-0011 and the provenance gate:
// strip or rewrite the incoherent sentence, record it in verifierSummary,
// never hard-fail the section.
//
// 1) enforceNumericCoherence — every magnitude-bearing number in a section's
//    narrative surfaces (prose, strategicVerdict, deployable copy) must trace
//    to the section's own structured evidence: a leaf value, a column sum, an
//    array length, or a per-column group/non-null count. Untraceable numbers
//    take their sentence with them. Because paid-media and the executive brief
//    re-read committed bodies, gating each section before commit also stops
//    a wrong number from propagating downstream.
// 2) scrubInternalJargon — pipeline vocabulary is not client prose. Run
//    8081e646 shipped "CHANNEL POLICY" and "verifiedCount=0" inside hero copy;
//    raw section ids (positioningDemandIntent) are rewritten to human labels,
//    config vocabulary sentences are removed.
// 3) enforceBriefNumericFidelity — the executive brief may only carry numbers
//    that appear in the committed section bodies it was written from (kills
//    brief-only phantoms like an invented "$30 click").

export interface NumericCoherenceStrike {
  field: string;
  numbers: string[];
  removedText: string;
}

export interface InternalJargonStrike {
  field: string;
  pattern: string;
  removedText: string;
}

export interface NumericTruthIndex {
  values: number[];
  // Subset of values that came from a percent figure. A percent narrative
  // token may only be backed numerically by one of these — a bare count or
  // dollar amount that equals 40 must never validate "40%".
  percentValues: number[];
  rawText: string;
}

interface GateResult<TRecord> {
  body: Record<string, unknown>;
  stripped: TRecord[];
}

export const numericCoherenceGapLine =
  "evidence gap: narrative removed — figures could not be traced to this section's own evidence.";

const sentenceSplitPattern = /(?<=[.!?])\s+/;

const approxClaimPattern = /~|≈|\bapproximately\b|\babout\b|\broughly\b|\baround\b|\bnearly\b|\bcirca\b/i;

const approxRelativeTolerance = 0.02;

// Narrative surfaces checked per section. "prose" and "strategicVerdict" are
// the analyst-narration fields every section carries; paid-media additionally
// owns model-authored deployable copy (mirrors the provenance gate's surface
// list). Structured evidence cells (keyword rows, quote cards, ad wall copy)
// are NOT here — they are the truth the narrative is checked against.
const baseProseClaimFields: readonly string[] = ["prose", "strategicVerdict"];

const proseClaimSurfaces: Record<string, ReadonlySet<string>> = {
  default: new Set(baseProseClaimFields),
  positioningDemandIntent: new Set([...baseProseClaimFields, "rationale"]),
  positioningPaidMediaPlan: new Set([
    ...baseProseClaimFields,
    "rationale",
    "recommendation",
    "hook",
    "description",
    "complaint",
    "howWeLeverage",
    "detail",
  ]),
};

// Model narrative may not self-vouch (mirrors the provenance gate): numbers in
// these fields never count as truth, even for sections whose surface config
// does not gate them.
const truthExcludedFieldNames: ReadonlySet<string> = new Set([
  ...baseProseClaimFields,
  "rationale",
  "recommendation",
  "grounding",
]);

// Pipeline/config vocabulary that must never reach client prose. Patterns stay
// tight to observed leaks plus unambiguous internal identifiers. The run
// 314d5f02 additions are process-excuse vocabulary: patterns anchor to the
// internal phrase, not the shared word — "ad budget" / "media budget" and a
// security subject's "quarantined files" are legitimate market prose and must
// survive.
const internalJargonPatterns: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: "channel-policy", pattern: /\bCHANNEL POLICY\b/ },
  { id: "verified-count", pattern: /\bverifiedCount\b\s*[:=]?\s*\d*/ },
  { id: "required-evidence", pattern: /\brequired_evidence\b/i },
  { id: "allowed-tools", pattern: /\ballowedTools\b/ },
  { id: "counts-toward-rollup", pattern: /\bcounts_toward_rollup\b/i },
  { id: "tool-budget", pattern: /\btool budgets?\b/i },
  { id: "budget-exhausted", pattern: /\bbudgets?\s+(?:were|was|are|is)\s+exhausted\b/i },
  { id: "prepass", pattern: /\bpre-?pass(?:es)?\b/i },
  { id: "candidate-pack", pattern: /\bcandidate packs?\b/i },
  { id: "displayable-creatives", pattern: /\bdisplayable creatives?\b/i },
  { id: "see-section-badge", pattern: /\bsee section badge\b/i },
  { id: "lead-list-available", pattern: /\bleadListAvailable\b/ },
  { id: "pre-normalized", pattern: /\bpre-?normali[sz]ed\b/i },
  {
    id: "quarantined-pipeline",
    pattern:
      /\bquarantined\s+(?:ads?|creatives?|advertisers?)\b|\b(?:ads?|creatives?|advertisers?)\s+(?:were|was|are|is)\s+quarantined\b/i,
  },
  {
    id: "quarantine-tier-ads",
    pattern:
      /\bquarantine-tier\s+(?:ads?|ad signals?|creatives?|creative signals?|competitor ads?)\b/i,
  },
  {
    id: "quarantine-only-ads",
    pattern:
      /\bquarantine-only\s+(?:ads?|ad signals?|creatives?|creative signals?|competitor ads?)\b|\b(?:ads?|ad signals?|creatives?|creative signals?|competitor ads?)\s+(?:were|was|are|is)\s+quarantine-only\b/i,
  },
];

const sectionIdHumanLabels: Record<string, string> = {
  deepResearchProgram: "the research corpus",
  positioningBuyerICP: "the buyer ICP section",
  positioningCompetitorLandscape: "the competitor landscape section",
  positioningDemandIntent: "the demand intent section",
  positioningMarketCategory: "the market category section",
  positioningOfferDiagnostic: "the offer diagnostic section",
  positioningPaidMediaPlan: "the paid media plan",
  positioningVoiceOfCustomer: "the voice-of-customer section",
};

const sectionIdMentionPattern =
  /\b(deepResearchProgram|positioning(?:BuyerICP|CompetitorLandscape|DemandIntent|MarketCategory|OfferDiagnostic|PaidMediaPlan|VoiceOfCustomer))\b/g;

const spelledNumberValues: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const spelledNumberAlternation = Object.keys(spelledNumberValues).join("|");

// Non-claims masked out before scanning prose: URLs, markdown link targets,
// bracketed citation markers, always-on shorthand, anchor ids, and product
// numbers that read as magnitudes but are names (run d838ed4e struck
// "Microsoft 365" prose because 365 tripped the bare-integer rule).
const maskPatterns: readonly RegExp[] = [
  /\bhttps?:\/\/\S+/g,
  /\]\([^)]*\)/g,
  /\[\d+\]/g,
  /\b24\/7\b/g,
  /#\d+\b/g,
  /\b(?:Microsoft|Office)\s*365\b/gi,
  /\bFortune\s*(?:50|100|500|1000)\b/gi,
  /\bS&P\s*500\b/gi,
  /\b(?:24[/x]7|365\s*days)\b/gi,
];

interface NumericToken {
  raw: string;
  values: number[];
  isPercent: boolean;
}

const suffixMultipliers: Record<string, number> = {
  b: 1_000_000_000,
  k: 1_000,
  m: 1_000_000,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalNumber(raw: string): number | null {
  const suffixMatch = /^([\d,.]+)\s?([kmb])$/i.exec(raw.trim());

  if (suffixMatch !== null) {
    const base = Number.parseFloat(suffixMatch[1].replace(/,/g, ""));
    const multiplier = suffixMultipliers[suffixMatch[2].toLowerCase()];

    return Number.isFinite(base) ? base * multiplier : null;
  }

  const value = Number.parseFloat(raw.replace(/[$,%\s,]/g, "").replace(/,/g, ""));

  return Number.isFinite(value) ? value : null;
}

function maskNonClaims(sentence: string): string {
  let masked = sentence;

  for (const pattern of maskPatterns) {
    masked = masked.replace(pattern, (match) => " ".repeat(match.length));
  }

  return masked;
}

function consume({
  masked,
  onMatch,
  pattern,
}: {
  masked: string;
  onMatch: (match: RegExpExecArray) => void;
  pattern: RegExp;
}): string {
  let next = masked;
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match = global.exec(next);

  while (match !== null) {
    onMatch(match);
    next =
      next.slice(0, match.index) +
      " ".repeat(match[0].length) +
      next.slice(match.index + match[0].length);
    global.lastIndex = match.index + match[0].length;
    match = global.exec(next);
  }

  return next;
}

function spelledOrDigits(token: string): number | null {
  const spelled = spelledNumberValues[token.toLowerCase()];

  if (spelled !== undefined) {
    return spelled;
  }

  return canonicalNumber(token);
}

// Extracts the magnitude-bearing numeric claims of one sentence: currency,
// percents, K/M/B-suffixed, comma-grouped, "N of M" count claims, and bare
// integers >= 100 (excluding years). Small bare integers stay unchecked — "two
// clusters" style prose is not a falsifiable table claim.
export function extractNumericTokens(sentence: string): NumericToken[] {
  const tokens: NumericToken[] = [];
  let masked = maskNonClaims(sentence);

  masked = consume({
    masked,
    onMatch: (match) => {
      const value = canonicalNumber(match[0].replace(/^\$\s?/, ""));

      if (value !== null) {
        tokens.push({ isPercent: false, raw: match[0], values: [value] });
      }
    },
    pattern: /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?[kmb])?\b/gi,
  });

  masked = consume({
    masked,
    onMatch: (match) => {
      const value = canonicalNumber(match[0]);

      if (value !== null) {
        tokens.push({ isPercent: true, raw: match[0], values: [value] });
      }
    },
    pattern: /\b\d{1,3}(?:\.\d+)?%/g,
  });

  masked = consume({
    masked,
    onMatch: (match) => {
      const value = canonicalNumber(match[0]);

      if (value !== null) {
        tokens.push({ isPercent: false, raw: match[0], values: [value] });
      }
    },
    pattern: /\b\d+(?:\.\d+)?\s?[kmb]\b/gi,
  });

  masked = consume({
    masked,
    onMatch: (match) => {
      const value = canonicalNumber(match[0]);

      if (value !== null) {
        tokens.push({ isPercent: false, raw: match[0], values: [value] });
      }
    },
    pattern: /\b\d{1,3}(?:,\d{3})+\b/g,
  });

  masked = consume({
    masked,
    onMatch: (match) => {
      const left = spelledOrDigits(match[1]);
      const right = spelledOrDigits(match[2]);

      if (left !== null && right !== null) {
        tokens.push({ isPercent: false, raw: match[0], values: [left, right] });
      }
    },
    pattern: new RegExp(
      `\\b(${spelledNumberAlternation}|\\d{1,4})\\s+(?:out\\s+of|of)\\s+(${spelledNumberAlternation}|\\d{1,4})\\b`,
      "gi",
    ),
  });

  consume({
    masked,
    onMatch: (match) => {
      const value = canonicalNumber(match[0]);

      if (value === null || (value >= 1900 && value <= 2099)) {
        return;
      }

      tokens.push({ isPercent: false, raw: match[0], values: [value] });
    },
    pattern: /\b\d{3,}\b/g,
  });

  return tokens;
}

function addStructuredStringNumbers(text: string, values: number[]): void {
  for (const match of text.matchAll(/\b\d+(?:\.\d+)?\s?[kmb]\b/gi)) {
    const value = canonicalNumber(match[0]);

    if (value !== null) {
      values.push(value);
    }
  }

  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const value = canonicalNumber(match[0]);

    if (value !== null) {
      values.push(value);
    }
  }
}

// Percent figures inside a structured cell ("40% (survey)") are the only
// numeric backing a percent narrative claim may match against.
function addStructuredStringPercents(text: string, percentValues: number[]): void {
  for (const match of text.matchAll(/\b\d{1,3}(?:\.\d+)?%/g)) {
    const value = canonicalNumber(match[0]);

    if (value !== null) {
      percentValues.push(value);
    }
  }
}

const maxGroupCountDistinctValues = 24;

// Derivable aggregates of an array of records: per-column numeric sums (the
// honest version of "total sourced volume ~7,300/mo"), per-column non-null
// counts and their complements, and per-column group counts for short string
// or boolean cells (the honest version of "six of twelve quotes describe X").
function addRecordArrayAggregates(
  items: readonly Record<string, unknown>[],
  values: number[],
): void {
  const keys = new Set<string>();

  for (const item of items) {
    for (const key of Object.keys(item)) {
      keys.add(key);
    }
  }

  for (const key of keys) {
    let numericCellCount = 0;
    let sum = 0;
    let nonNullCount = 0;
    const groupCounts = new Map<string, number>();

    for (const item of items) {
      const cell = item[key];

      if (cell !== null && cell !== undefined && cell !== "") {
        nonNullCount += 1;
      }

      if (typeof cell === "number" && Number.isFinite(cell)) {
        numericCellCount += 1;
        sum += cell;
      } else if (typeof cell === "string") {
        const firstNumber = /\d[\d,]*(?:\.\d+)?/.exec(cell);

        if (firstNumber !== null) {
          const value = canonicalNumber(firstNumber[0]);

          if (value !== null) {
            numericCellCount += 1;
            sum += value;
          }
        }

        if (cell.length <= 60) {
          const groupKey = cell.trim().toLowerCase();
          groupCounts.set(groupKey, (groupCounts.get(groupKey) ?? 0) + 1);
        }
      } else if (typeof cell === "boolean") {
        const groupKey = String(cell);
        groupCounts.set(groupKey, (groupCounts.get(groupKey) ?? 0) + 1);
      }
    }

    if (numericCellCount >= 2) {
      values.push(sum, Math.round(sum));
    }

    values.push(nonNullCount, items.length - nonNullCount);

    if (groupCounts.size <= maxGroupCountDistinctValues) {
      for (const count of groupCounts.values()) {
        values.push(count, items.length - count);
      }
    }
  }
}

function walkTruth({
  excludeFields,
  percentValues,
  rawParts,
  value,
  values,
}: {
  excludeFields: ReadonlySet<string>;
  percentValues: number[];
  rawParts: string[];
  value: unknown;
  values: number[];
}): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    values.push(value);
    rawParts.push(String(value));
    return;
  }

  if (typeof value === "string") {
    rawParts.push(value);
    addStructuredStringNumbers(value, values);
    addStructuredStringPercents(value, percentValues);
    return;
  }

  if (Array.isArray(value)) {
    values.push(value.length);

    const records = value.filter(isRecord);

    if (records.length === value.length && records.length > 0) {
      addRecordArrayAggregates(records, values);
    }

    for (const item of value) {
      walkTruth({ excludeFields, percentValues, rawParts, value: item, values });
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (excludeFields.has(key)) {
      continue;
    }

    walkTruth({ excludeFields, percentValues, rawParts, value: childValue, values });
  }
}

export function buildNumericTruthIndex({
  excludeFields,
  value,
}: {
  excludeFields: ReadonlySet<string>;
  value: unknown;
}): NumericTruthIndex {
  const values: number[] = [];
  const percentValues: number[] = [];
  const rawParts: string[] = [];

  walkTruth({ excludeFields, percentValues, rawParts, value, values });

  return { percentValues, rawText: rawParts.join("\n"), values };
}

function valueTraceable({
  allowApprox,
  isPercent,
  truth,
  value,
}: {
  allowApprox: boolean;
  isPercent: boolean;
  truth: NumericTruthIndex;
  value: number;
}): boolean {
  // Zero claims cannot inflate the evidence — "zero of twelve" is honest by
  // construction.
  if (value === 0) {
    return true;
  }

  // A percent token may only be matched (exactly or within tolerance) against
  // pooled percent figures; a bare count or dollar amount that equals 40 must
  // never validate "40%". The fractional rule (a stored ratio 0.40 backing
  // 40%) still scans all values.
  const sameKind = isPercent ? truth.percentValues : truth.values;

  for (const candidate of sameKind) {
    if (Math.abs(candidate - value) < 1e-6) {
      return true;
    }

    if (
      allowApprox &&
      Math.abs(candidate - value) / Math.max(Math.abs(candidate), 1) <=
        approxRelativeTolerance
    ) {
      return true;
    }
  }

  if (isPercent) {
    for (const candidate of truth.values) {
      if (Math.abs(candidate * 100 - value) < 1e-6) {
        return true;
      }
    }
  }

  return false;
}

function tokenTraceable({
  sentence,
  token,
  truth,
}: {
  sentence: string;
  token: NumericToken;
  truth: NumericTruthIndex;
}): boolean {
  const allowApprox =
    approxClaimPattern.test(sentence) || token.raw.trimStart().startsWith("~");

  const allValuesTrace = token.values.every((value) =>
    valueTraceable({ allowApprox, isPercent: token.isPercent, truth, value }),
  );

  if (allValuesTrace) {
    return true;
  }

  // Format-identical fallback: the exact figure string appears in a structured
  // cell ("5,900" inside "5,900 (SpyFu-estimated)").
  const rawDigits = token.raw.replace(/^[~$\s]+/, "").trim();

  return rawDigits.length >= 3 && truth.rawText.includes(rawDigits);
}

export function gateProseNumbers({
  field,
  truth,
  value,
}: {
  field: string;
  truth: NumericTruthIndex;
  value: string;
}): { strikes: NumericCoherenceStrike[]; value: string } {
  const sentences = value.split(sentenceSplitPattern);
  const kept: string[] = [];
  const strikes: NumericCoherenceStrike[] = [];

  for (const sentence of sentences) {
    const tokens = extractNumericTokens(sentence);
    const untraceable = tokens.filter(
      (token) => !tokenTraceable({ sentence, token, truth }),
    );

    if (untraceable.length === 0) {
      kept.push(sentence);
      continue;
    }

    strikes.push({
      field,
      numbers: untraceable.map((token) => token.raw),
      removedText: sentence,
    });
  }

  if (strikes.length === 0) {
    return { strikes, value };
  }

  const next = kept.join(" ").trim();

  return {
    strikes,
    value: next.length === 0 ? numericCoherenceGapLine : next,
  };
}

export function scrubInternalJargon({
  field,
  value,
}: {
  field: string;
  value: string;
}): { strikes: InternalJargonStrike[]; value: string } {
  const strikes: InternalJargonStrike[] = [];
  const sentences = value.split(sentenceSplitPattern);
  const kept: string[] = [];

  for (const sentence of sentences) {
    const matched = internalJargonPatterns.find(({ pattern }) =>
      pattern.test(sentence),
    );

    if (matched !== undefined) {
      strikes.push({
        field,
        pattern: matched.id,
        removedText: sentence,
      });
      continue;
    }

    kept.push(sentence);
  }

  let next = strikes.length === 0 ? value : kept.join(" ").trim();

  next = next.replace(sectionIdMentionPattern, (match) => {
    const label = sectionIdHumanLabels[match];

    if (label === undefined) {
      return match;
    }

    strikes.push({ field, pattern: "section-id-humanized", removedText: match });

    return label;
  });

  if (strikes.length === 0) {
    return { strikes, value };
  }

  return {
    strikes,
    value:
      next.trim().length === 0
        ? "evidence gap: narrative removed — internal pipeline vocabulary is not client prose."
        : next,
  };
}

function walkProseSurfaces({
  onField,
  path,
  surfaces,
  value,
}: {
  onField: (context: { field: string; holder: Record<string, unknown>; key: string; text: string }) => void;
  path: string;
  surfaces: ReadonlySet<string>;
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkProseSurfaces({
        onField,
        path: `${path}[${index}]`,
        surfaces,
        value: item,
      });
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (typeof childValue === "string" && surfaces.has(key)) {
      onField({ field: childPath, holder: value, key, text: childValue });
      continue;
    }

    walkProseSurfaces({ onField, path: childPath, surfaces, value: childValue });
  }
}

function surfacesForSection(sectionId: string): ReadonlySet<string> {
  return proseClaimSurfaces[sectionId] ?? proseClaimSurfaces.default;
}

// Verifier-verified claim values are sourced facts: a figure the claim
// verifier matched to a tool result or corpus excerpt must never be struck as
// incoherent just because it lives only in narrative. Strings are walked
// individually (not as an array) so the claim COUNT never enters the truth.
function buildVerifiedClaimTruth(
  verifiedClaimValues: readonly string[],
): NumericTruthIndex {
  const values: number[] = [];
  const percentValues: number[] = [];
  const rawParts: string[] = [];

  for (const claimValue of verifiedClaimValues) {
    rawParts.push(claimValue);
    addStructuredStringNumbers(claimValue, values);
    addStructuredStringPercents(claimValue, percentValues);
  }

  return { percentValues, rawText: rawParts.join("\n"), values };
}

export function buildSectionNumericTruth({
  auxiliaryEvidence,
  body,
  sectionId,
  verifiedClaimValues,
}: {
  auxiliaryEvidence?: unknown;
  body: Record<string, unknown>;
  sectionId: string;
  verifiedClaimValues?: readonly string[];
}): NumericTruthIndex {
  const excludeFields = new Set([
    ...surfacesForSection(sectionId),
    ...truthExcludedFieldNames,
  ]);

  const ownTruth = buildNumericTruthIndex({ excludeFields, value: body });
  const claimTruth = buildVerifiedClaimTruth(verifiedClaimValues ?? []);

  // A section's permissible fact universe is its own evidence PLUS the
  // research input it was written from (corpus rows; for paid-media also the
  // committed sibling bodies merged into its ResearchInput) PLUS every claim
  // the verifier matched to a real source. A figure traced to any of these is
  // sourced, not incoherent — only numbers backed by none are
  // fabrication-class.
  const inputTruth =
    auxiliaryEvidence === undefined
      ? { percentValues: [] as number[], rawText: "", values: [] as number[] }
      : buildNumericTruthIndex({
          excludeFields: new Set<string>(),
          value: auxiliaryEvidence,
        });

  return {
    percentValues: [
      ...ownTruth.percentValues,
      ...inputTruth.percentValues,
      ...claimTruth.percentValues,
    ],
    rawText: [ownTruth.rawText, inputTruth.rawText, claimTruth.rawText]
      .filter((part) => part.length > 0)
      .join("\n"),
    values: [...ownTruth.values, ...inputTruth.values, ...claimTruth.values],
  };
}

export function enforceNumericCoherence({
  auxiliaryEvidence,
  body,
  sectionId,
  verifiedClaimValues,
}: {
  auxiliaryEvidence?: unknown;
  body: Record<string, unknown>;
  sectionId: string;
  verifiedClaimValues?: readonly string[];
}): GateResult<NumericCoherenceStrike> {
  const surfaces = surfacesForSection(sectionId);
  const truth = buildSectionNumericTruth({
    auxiliaryEvidence,
    body,
    sectionId,
    ...(verifiedClaimValues === undefined ? {} : { verifiedClaimValues }),
  });
  const cloned = structuredClone(body);
  const stripped: NumericCoherenceStrike[] = [];

  walkProseSurfaces({
    onField: ({ field, holder, key, text }) => {
      const gated = gateProseNumbers({ field, truth, value: text });

      if (gated.strikes.length > 0) {
        holder[key] = gated.value;
        stripped.push(...gated.strikes);
      }
    },
    path: "body",
    surfaces,
    value: cloned,
  });

  return stripped.length === 0 ? { body, stripped } : { body: cloned, stripped };
}

export function scrubBodyInternalJargon({
  body,
  sectionId,
}: {
  body: Record<string, unknown>;
  sectionId: string;
}): GateResult<InternalJargonStrike> {
  const surfaces = surfacesForSection(sectionId);
  const cloned = structuredClone(body);
  const stripped: InternalJargonStrike[] = [];

  walkProseSurfaces({
    onField: ({ field, holder, key, text }) => {
      const scrubbed = scrubInternalJargon({ field, value: text });

      if (scrubbed.strikes.length > 0) {
        holder[key] = scrubbed.value;
        stripped.push(...scrubbed.strikes);
      }
    },
    path: "body",
    surfaces,
    value: cloned,
  });

  return stripped.length === 0 ? { body, stripped } : { body: cloned, stripped };
}

export interface BriefFidelityStrike {
  field: string;
  kind: "internal-jargon" | "number-untraceable" | "section-id-humanized";
  removedText: string;
}

// The executive brief's only permissible fact source is the committed section
// bodies it was written from — section prose has already passed its own
// section's gate, so the whole body counts as truth here.
export function enforceBriefNumericFidelity({
  moves,
  sectionBodies,
  thesis,
}: {
  moves: readonly string[];
  sectionBodies: readonly Record<string, unknown>[];
  thesis: string;
}): { moves: string[]; strikes: BriefFidelityStrike[]; thesis: string } {
  const truth = buildNumericTruthIndex({
    excludeFields: new Set<string>(),
    value: sectionBodies,
  });
  const strikes: BriefFidelityStrike[] = [];

  const jargonScrubbedThesis = scrubInternalJargon({
    field: "executiveThesis",
    value: thesis,
  });

  for (const strike of jargonScrubbedThesis.strikes) {
    strikes.push({
      field: strike.field,
      kind:
        strike.pattern === "section-id-humanized"
          ? "section-id-humanized"
          : "internal-jargon",
      removedText: strike.removedText,
    });
  }

  const gatedThesis = gateProseNumbers({
    field: "executiveThesis",
    truth,
    value: jargonScrubbedThesis.value,
  });

  for (const strike of gatedThesis.strikes) {
    strikes.push({
      field: strike.field,
      kind: "number-untraceable",
      removedText: strike.removedText,
    });
  }

  const gatedMoves = moves.map((move, index) => {
    const field = `rankedMoves[${index}].move`;
    const scrubbed = scrubInternalJargon({ field, value: move });

    for (const strike of scrubbed.strikes) {
      strikes.push({
        field: strike.field,
        kind:
          strike.pattern === "section-id-humanized"
            ? "section-id-humanized"
            : "internal-jargon",
        removedText: strike.removedText,
      });
    }

    // Moves are single committed actions: excise the untraceable figure, keep
    // the action. Sentence-stripping a one-sentence move would delete it.
    let next = scrubbed.value;

    for (const token of extractNumericTokens(next)) {
      if (tokenTraceable({ sentence: next, token, truth })) {
        continue;
      }

      strikes.push({
        field,
        kind: "number-untraceable",
        removedText: token.raw,
      });
      next = next.replace(token.raw, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
    }

    return next;
  });

  return {
    moves: gatedMoves,
    strikes,
    thesis: gatedThesis.value,
  };
}
