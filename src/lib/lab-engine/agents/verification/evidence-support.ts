import { quoteAttributionFieldNames } from "./claim-extractor";
import type { Claim, ClaimVerdict, VerificationReport } from "./types";

export type LoadBearingClaimKind = Extract<
  Claim["kind"],
  "numeric" | "sourceAttribution" | "url" | "quote"
>;

export type UnsupportedLoadBearingClaim = Extract<
  ClaimVerdict,
  { status: "unsupported" }
> & {
  claim: Extract<Claim, { kind: LoadBearingClaimKind }>;
};

export type ProvenanceFlagReason = "no-source" | "misattributed";

export interface ProvenanceFlag {
  value: string;
  reason: ProvenanceFlagReason;
  detail: string;
}

export interface EvidenceSupportShortfall {
  unsupportedLoadBearing: UnsupportedLoadBearingClaim[];
  issues: string[];
  provenanceFlags: ProvenanceFlag[];
}

export interface EvaluateEvidenceSupportInput {
  verification: VerificationReport;
  loadBearingKinds?: readonly LoadBearingClaimKind[];
}

const defaultLoadBearingKinds = ["numeric", "sourceAttribution", "url"] as const;
const verifierMaxUnsupportedEnvKey = "LAB_VERIFIER_MAX_UNSUPPORTED";
// Default OPEN (Infinity): the evidence gate is advisory unless an operator sets
// LAB_VERIFIER_MAX_UNSUPPORTED to a finite integer. A finite default would hard-fail
// most sections after repairs (the verifier is substring-match, ~65% verified on real
// runs) and revive the per-section repair storm. Low-confidence sections are surfaced
// for review via grounded confidence at commit time, not by deleting the section here.
const defaultMaxUnsupportedAllowed = Infinity;
const operatorProvenanceMarkers = ["operator-supplied", "client brief"] as const;
const trustedUserProvidedNumericFields = new Set([
  "acv",
  "avgltv",
  "avgsalescycle",
  "budgetsplit",
  "conversionpath",
  "currentcac",
  "demotoclose",
  "economics.acv",
  "economics.avgltv",
  "economics.avgsalescycle",
  "economics.budgetsplit",
  "economics.conversionpath",
  "economics.currentcac",
  "economics.demotoclose",
  "economics.growthtrend",
  "economics.monthlyadbudget",
  "economics.monthlyrevenue",
  "economics.pricingmodel",
  "economics.pricingtiers",
  "economics.signuptoactivation",
  "economics.targetcac",
  "economics.targetplan",
  "economics.visitortosignup",
  "growthtrend",
  "monthlyadbudget",
  "monthlyrevenue",
  "pricingmodel",
  "pricingtiers",
  "signuptoactivation",
  "targetcac",
  "targetplan",
  "visitortosignup",
]);
const platformHosts = {
  capterra: new Set(["capterra.com"]),
  g2: new Set(["g2.com", "g2crowd.com"]),
  gartner: new Set(["gartner.com"]),
  reddit: new Set(["reddit.com", "old.reddit.com", "redd.it", "np.reddit.com"]),
  trustpilot: new Set(["trustpilot.com"]),
} as const;

type KnownPlatform = keyof typeof platformHosts;
type QuoteAttributionVerdict = ClaimVerdict & {
  claim: Extract<Claim, { kind: "quoteAttribution" }>;
};

function isUnsupportedLoadBearingClaim(
  verdict: ClaimVerdict,
  loadBearingKinds: ReadonlySet<Claim["kind"]>,
): verdict is UnsupportedLoadBearingClaim {
  return (
    verdict.status === "unsupported" &&
    loadBearingKinds.has(verdict.claim.kind)
  );
}

function formatUnsupportedClaimIssue(
  verdict: UnsupportedLoadBearingClaim,
): string {
  return `${verdict.claim.kind} claim "${verdict.claim.value}" is not supported by any fetched source or corpus excerpt - cite a real source for it or remove it / restate it as a data gap.`;
}

function isNumericClaim(
  claim: Claim,
): claim is Extract<Claim, { kind: "numeric" | "numericAttribution" }> {
  return claim.kind === "numeric" || claim.kind === "numericAttribution";
}

function isQuoteAttributionVerdict(
  verdict: ClaimVerdict,
): verdict is QuoteAttributionVerdict {
  return verdict.claim.kind === "quoteAttribution";
}

function hasOperatorProvenanceMarker(claim: Claim): boolean {
  const raw = claim.raw.toLowerCase();

  return operatorProvenanceMarkers.some((marker) => raw.includes(marker));
}

function normalizeFieldName(field: string): string {
  return field
    .toLowerCase()
    .replace(/[^a-z0-9.[\]]+/g, "")
    .replace(/\[(\d+)\]/g, ".$1");
}

function isTrustedUserProvidedNumericField(field: string | undefined): boolean {
  if (field === undefined) {
    return false;
  }

  const normalized = normalizeFieldName(field);

  return Array.from(trustedUserProvidedNumericFields).some(
    (trustedField) =>
      normalized === trustedField || normalized.endsWith(`.${trustedField}`),
  );
}

function isTrustedNumericVerdict(verdict: ClaimVerdict): boolean {
  if (!isNumericClaim(verdict.claim)) {
    return false;
  }

  if (hasOperatorProvenanceMarker(verdict.claim)) {
    return true;
  }

  if (verdict.status !== "verified") {
    return false;
  }

  if (
    verdict.matchedSourceRef.kind === "toolResult" ||
    verdict.matchedSourceRef.kind === "corpusExcerpt"
  ) {
    return true;
  }

  return isTrustedUserProvidedNumericField(verdict.matchedSourceRef.field);
}

function formatNumericNoSourceFlag(verdict: ClaimVerdict): ProvenanceFlag {
  const sourceDetail =
    verdict.status === "verified" &&
    verdict.matchedSourceRef.kind === "userProvided"
      ? `matched only user-provided field "${verdict.matchedSourceRef.field ?? "unknown"}", which is not an approved numeric provenance field`
      : "no source contains the asserted number at the cited source URL";

  return {
    value: verdict.claim.value,
    reason: "no-source",
    detail: `numeric claim "${verdict.claim.value}" needs review: ${sourceDetail}.`,
  };
}

function canonicalPlatform(value: string): KnownPlatform | null {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));

  if (normalized === "g2" || normalized === "g2 reviews") {
    return "g2";
  }

  if (tokens.has("reddit")) {
    return "reddit";
  }

  if (tokens.has("capterra")) {
    return "capterra";
  }

  if (tokens.has("trustpilot")) {
    return "trustpilot";
  }

  if (tokens.has("gartner")) {
    return "gartner";
  }

  return null;
}

function hostForUrl(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hostMatchesPlatform(host: string, platform: KnownPlatform): boolean {
  return Array.from(platformHosts[platform]).some(
    (acceptedHost) =>
      host === acceptedHost || host.endsWith(`.${acceptedHost}`),
  );
}

function formatMisattributedQuoteFlag({
  host,
  platform,
  verdict,
}: {
  host: string;
  platform: KnownPlatform;
  verdict: QuoteAttributionVerdict;
}): ProvenanceFlag {
  return {
    value: verdict.claim.value,
    reason: "misattributed",
    detail: `possible misattribution: quote "${verdict.claim.value}" is labeled "${verdict.claim.assertedSource}" but source URL host "${host}" is not an accepted ${platform} host.`,
  };
}

function pushProvenanceFlag({
  flag,
  provenanceFlags,
  seen,
}: {
  flag: ProvenanceFlag;
  provenanceFlags: ProvenanceFlag[];
  seen: Set<string>;
}): void {
  const key = `${flag.reason}:${flag.value}:${flag.detail}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  provenanceFlags.push(flag);
}

function evaluateNumericProvenanceFlag(
  verdict: ClaimVerdict,
): ProvenanceFlag | null {
  if (!isNumericClaim(verdict.claim) || isTrustedNumericVerdict(verdict)) {
    return null;
  }

  if (
    verdict.claim.kind === "numericAttribution" &&
    verdict.status === "unsupported"
  ) {
    return formatNumericNoSourceFlag(verdict);
  }

  if (
    verdict.status === "verified" &&
    verdict.matchedSourceRef.kind === "userProvided"
  ) {
    return formatNumericNoSourceFlag(verdict);
  }

  return null;
}

function evaluateQuoteAttributionFlag(
  verdict: ClaimVerdict,
): ProvenanceFlag | null {
  if (!isQuoteAttributionVerdict(verdict)) {
    return null;
  }

  const platform = canonicalPlatform(verdict.claim.assertedSource);

  if (platform === null) {
    return null;
  }

  const host = hostForUrl(verdict.claim.assertedSourceUrl);

  if (host === null || hostMatchesPlatform(host, platform)) {
    return null;
  }

  return formatMisattributedQuoteFlag({ host, platform, verdict });
}

function evaluateProvenanceFlags(
  verification: VerificationReport,
): ProvenanceFlag[] {
  const provenanceFlags: ProvenanceFlag[] = [];
  const seen = new Set<string>();

  for (const verdict of verification.claims) {
    const numericFlag = evaluateNumericProvenanceFlag(verdict);

    if (numericFlag !== null) {
      pushProvenanceFlag({ flag: numericFlag, provenanceFlags, seen });
    }

    const quoteFlag = evaluateQuoteAttributionFlag(verdict);

    if (quoteFlag !== null) {
      pushProvenanceFlag({ flag: quoteFlag, provenanceFlags, seen });
    }
  }

  return provenanceFlags;
}

export function evaluateEvidenceSupport({
  loadBearingKinds = defaultLoadBearingKinds,
  verification,
}: EvaluateEvidenceSupportInput): EvidenceSupportShortfall {
  const loadBearingKindSet = new Set<Claim["kind"]>(loadBearingKinds);
  const unsupportedLoadBearing = verification.claims.filter((verdict) =>
    isUnsupportedLoadBearingClaim(verdict, loadBearingKindSet),
  );

  return {
    unsupportedLoadBearing,
    issues: unsupportedLoadBearing.map(formatUnsupportedClaimIssue),
    provenanceFlags: evaluateProvenanceFlags(verification),
  };
}

/** One quote whose false platform attribution was relabeled before commit. */
export interface StrippedQuoteAttribution {
  /** Normalized quote text whose platform label was stripped. */
  value: string;
  /** The source label the body asserted (e.g. "G2"). */
  claimedSource: string;
  /** Canonical platform that label mapped to (e.g. "g2"). */
  claimedPlatform: KnownPlatform;
  /** Actual host of the cited sourceUrl (the host that really served it). */
  actualHost: string;
  /** The honest label written into the committed body. */
  relabeledTo: string;
  /** Which record field carried the false label. */
  field: "source" | "platform";
  /** Path of the relabeled record within the artifact body. */
  path: string;
}

export interface StripMisattributedQuoteAttributionsResult {
  body: Record<string, unknown>;
  stripped: StrippedQuoteAttribution[];
}

export type StrippedNumericClaimAction =
  | "marker"
  | "marker-aggregated"
  | "evidence-gap"
  | "provenance-unknown"
  | "verified-marker-removed";

export interface StrippedNumericClaim {
  value: string;
  action: StrippedNumericClaimAction;
  field?: string;
}

export interface RedactUnsupportedNumericClaimsResult {
  body: Record<string, unknown>;
  stripped: StrippedNumericClaim[];
}

export interface UnsupportedNumericToken {
  value: string;
}

const unverifiedMarker = "[unverified]";
const modelAuthoredVerifiedMarkerPattern =
  /\s*\[\s*verified\b[^\]\n]{0,160}\]/giu;
const modelAuthoredVerifiedMarkerProbePattern =
  /\[\s*verified\b[^\]\n]{0,160}\]/iu;
const trustedPaidMediaMoneyProvenances = new Set([
  "user-supplied",
  "tool-measured",
  "source-reported",
]);
const demandIntentKeywordNumericFieldNames = new Set([
  "monthlyvolume",
  "cpc",
]);
const bottomUpTamPath = "body.marketSize.bottomUpTam";

function stringFieldValue(
  record: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  const value = record[fieldName];

  return typeof value === "string" && normalizeWhitespace(value).length > 0
    ? value
    : undefined;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function relabelMisattributedRecord({
  path,
  record,
  relabelSource,
  stripped,
}: {
  path: string;
  record: Record<string, unknown>;
  relabelSource: (context: { actualHost: string }) => string;
  stripped: StrippedQuoteAttribution[];
}): void {
  const sourceUrl = stringFieldValue(record, "sourceUrl");

  if (sourceUrl === undefined) {
    return;
  }

  const quote = quoteAttributionFieldNames
    .map((fieldName) => stringFieldValue(record, fieldName))
    .find((value) => value !== undefined);

  if (quote === undefined) {
    return;
  }

  const field =
    stringFieldValue(record, "source") !== undefined
      ? ("source" as const)
      : stringFieldValue(record, "platform") !== undefined
        ? ("platform" as const)
        : null;

  if (field === null) {
    return;
  }

  const claimedSource = record[field] as string;
  const platform = canonicalPlatform(claimedSource);

  if (platform === null) {
    return;
  }

  const host = hostForUrl(sourceUrl);

  if (host === null || hostMatchesPlatform(host, platform)) {
    return;
  }

  const relabeledTo = relabelSource({ actualHost: host });

  record[field] = relabeledTo;
  stripped.push({
    actualHost: host,
    claimedPlatform: platform,
    claimedSource: normalizeWhitespace(claimedSource),
    field,
    path,
    relabeledTo,
    value: normalizeWhitespace(quote),
  });
}

function walkBodyForMisattributedQuotes({
  path,
  relabelSource,
  stripped,
  value,
}: {
  path: string;
  relabelSource: (context: { actualHost: string }) => string;
  stripped: StrippedQuoteAttribution[];
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkBodyForMisattributedQuotes({
        path: `${path}[${index}]`,
        relabelSource,
        stripped,
        value: item,
      });
    });
    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;

  relabelMisattributedRecord({ path, record, relabelSource, stripped });

  for (const [key, childValue] of Object.entries(record)) {
    walkBodyForMisattributedQuotes({
      path: `${path}.${key}`,
      relabelSource,
      stripped,
      value: childValue,
    });
  }
}

/**
 * Per-claim provenance strip: walks the artifact body for records that assert
 * a known review/community platform (the same record shape the claim extractor
 * turns into quoteAttribution claims) whose sourceUrl host does NOT belong to
 * that platform, and relabels the false attribution via the caller-supplied
 * relabeler. The quote is kept; only the lie about where it came from is
 * removed. Mirrors evaluateQuoteAttributionFlag's detection so every
 * `misattributed` provenance flag has a corresponding strip — but re-walks the
 * body so duplicate-quote records the claim dedup collapsed are caught too.
 *
 * Never throws, never drops a record, never blocks commit: the input body is
 * returned untouched (same reference) when nothing offends.
 */
export function stripMisattributedQuoteAttributions({
  body,
  relabelSource,
}: {
  body: Record<string, unknown>;
  relabelSource: (context: { actualHost: string }) => string;
}): StripMisattributedQuoteAttributionsResult {
  const cloned = structuredClone(body);
  const stripped: StrippedQuoteAttribution[] = [];

  walkBodyForMisattributedQuotes({
    path: "body",
    relabelSource,
    stripped,
    value: cloned,
  });

  return stripped.length === 0 ? { body, stripped } : { body: cloned, stripped };
}

function normalizeNumericTokenValue(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function collectUnsupportedNumericTokens(
  verification: VerificationReport,
): UnsupportedNumericToken[] {
  const verifiedValues = new Set(
    verification.claims
      .filter(
        (verdict) =>
          verdict.status === "verified" && isNumericClaim(verdict.claim),
      )
      .map((verdict) => normalizeNumericTokenValue(verdict.claim.value)),
  );
  const seen = new Set<string>();
  const tokens: UnsupportedNumericToken[] = [];

  for (const verdict of verification.claims) {
    if (verdict.status !== "unsupported" || !isNumericClaim(verdict.claim)) {
      continue;
    }

    const normalizedValue = normalizeNumericTokenValue(verdict.claim.value);

    if (verifiedValues.has(normalizedValue) || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    tokens.push({ value: verdict.claim.value });
  }

  return tokens.sort((left, right) => right.value.length - left.value.length);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAlphanumericChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9]/.test(char);
}

function isDigitChar(char: string | undefined): boolean {
  return char !== undefined && /[0-9]/.test(char);
}

// A marker may only be spliced at a clean token boundary. A raw substring
// match inside a longer word or number corrupts the prose — the live
// `$450/mo [unverified]nth` defect — so embedded matches are skipped: the
// claim stays unsupported in the verification report and the badge covers it.
export function isCleanTokenBoundary({
  matchLength,
  offset,
  source,
}: {
  matchLength: number;
  offset: number;
  source: string;
}): boolean {
  const before = source[offset - 1];
  const after = source[offset + matchLength];

  if (isAlphanumericChar(before) || isAlphanumericChar(after)) {
    return false;
  }

  const firstChar = source[offset];
  const lastChar = source[offset + matchLength - 1];

  // Grouped/decimal number continuation across the edge: "300" inside
  // "1,300", "24" inside "24.8B", "1,300" inside "1,300,500".
  if (
    (before === "," || before === ".") &&
    isDigitChar(source[offset - 2]) &&
    isDigitChar(firstChar)
  ) {
    return false;
  }

  if (
    (after === "," || after === ".") &&
    isDigitChar(source[offset + matchLength + 1]) &&
    isDigitChar(lastChar)
  ) {
    return false;
  }

  // A percent glued to the digits is part of the figure: never produce
  // "100 [unverified]%".
  if (after === "%" && isDigitChar(lastChar)) {
    return false;
  }

  return true;
}

function markNumericToken({
  budget,
  token,
  value,
}: {
  budget?: InlineMarkerBudget;
  token: UnsupportedNumericToken;
  value: string;
}): { appliedCount: number; value: string } {
  if (token.value.length === 0 || !value.includes(token.value)) {
    return { appliedCount: 0, value };
  }

  let appliedCount = 0;
  const pattern = new RegExp(escapeRegExp(token.value), "g");
  const redacted = value.replace(pattern, (match, offset: number, source) => {
    const following = source.slice(offset + match.length);

    if (/^\s*\[unverified\]/i.test(following)) {
      return match;
    }

    if (
      !isCleanTokenBoundary({ matchLength: match.length, offset, source })
    ) {
      return match;
    }

    if (budget !== undefined) {
      if (budget.remaining <= 0) {
        return match;
      }

      budget.remaining -= 1;
    }

    appliedCount += 1;
    return `${match} ${unverifiedMarker}`;
  });

  return { appliedCount, value: redacted };
}

// Above this many applied marker occurrences in one field, inline markers
// stop reading as annotation and start reading as static. The field keeps its
// prose intact and carries ONE aggregate footnote instead; per-token stripped
// actions still record every figure for the report and badge.
export const inlineMarkerCapPerField = 3;

// Section-wide occurrence budget for spliced [unverified] markers. Run
// 314d5f02 shipped 83 inline markers because the per-field cap counted
// distinct tokens while every occurrence was spliced globally. Beyond this
// budget splicing stops: the claims stay recorded as "marker-aggregated" and
// the section badge covers them (same posture as the boundary-skip above).
export const inlineMarkerBudgetPerSection = 6;

interface InlineMarkerBudget {
  remaining: number;
}

function buildAggregateMarkerFootnote(count: number): string {
  return `[${count} figure${count === 1 ? "" : "s"} in this field ${
    count === 1 ? "is" : "are"
  } unverified — see section badge]`;
}

function appendMarkerActions({
  budget,
  field,
  stripped,
  tokens,
  value,
}: {
  budget?: InlineMarkerBudget;
  field: string;
  stripped: StrippedNumericClaim[];
  tokens: readonly UnsupportedNumericToken[];
  value: string;
}): string {
  // Dry run (no budget consumed): which tokens are markable in this field and
  // how many occurrences would actually be spliced.
  const markableTokens: UnsupportedNumericToken[] = [];
  let markableOccurrenceCount = 0;

  for (const token of tokens) {
    const { appliedCount } = markNumericToken({ token, value });

    if (appliedCount > 0) {
      markableTokens.push(token);
      markableOccurrenceCount += appliedCount;
    }
  }

  if (markableOccurrenceCount === 0) {
    return value;
  }

  if (markableOccurrenceCount > inlineMarkerCapPerField) {
    for (const token of markableTokens) {
      stripped.push({
        action: "marker-aggregated",
        field,
        value: token.value,
      });
    }

    return `${value} ${buildAggregateMarkerFootnote(markableTokens.length)}`;
  }

  let nextValue = value;

  for (const token of markableTokens) {
    const result = markNumericToken({ budget, token, value: nextValue });

    if (result.appliedCount === 0) {
      // Markable, but the section budget is exhausted: record without
      // splicing — verifierSummary distinguishes shipped vs aggregated.
      stripped.push({
        action: "marker-aggregated",
        field,
        value: token.value,
      });
      continue;
    }

    nextValue = result.value;
    stripped.push({
      action: "marker",
      field,
      value: token.value,
    });
  }

  return nextValue;
}

export function stripModelAuthoredVerifiedMarkers({
  field,
  value,
}: {
  field?: string;
  value: string;
}): { stripped: StrippedNumericClaim[]; value: string } {
  const matches = Array.from(value.matchAll(modelAuthoredVerifiedMarkerPattern));

  if (matches.length === 0) {
    return { stripped: [], value };
  }

  return {
    stripped: matches.map((match) => ({
      action: "verified-marker-removed",
      ...(field === undefined ? {} : { field }),
      value: match[0].trim(),
    })),
    value: value.replace(modelAuthoredVerifiedMarkerPattern, ""),
  };
}

function matchingUnsupportedTokens({
  tokens,
  value,
}: {
  tokens: readonly UnsupportedNumericToken[];
  value: string;
}): UnsupportedNumericToken[] {
  return tokens.filter((token) => value.includes(token.value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingString(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function relabelBottomUpTamInput({
  input,
  path,
  stripped,
  tokens,
}: {
  input: Record<string, unknown>;
  path: string;
  stripped: StrippedNumericClaim[];
  tokens: readonly UnsupportedNumericToken[];
}): boolean {
  if (typeof input.value !== "string" || typeof input.inputType !== "string") {
    return false;
  }

  if (!isMissingString(input.sourceUrl)) {
    return false;
  }

  const matchingTokens = matchingUnsupportedTokens({
    tokens,
    value: input.value,
  });

  if (matchingTokens.length === 0) {
    return false;
  }

  const evidenceGapValue = `evidence gap: ${input.inputType} unsourced`;
  const alreadyRelabeled =
    input.status === "evidence-gap" && input.value === evidenceGapValue;

  if (alreadyRelabeled) {
    return false;
  }

  input.status = "evidence-gap";
  input.value = evidenceGapValue;
  stripped.push({
    action: "evidence-gap",
    field: `${path}.value`,
    value: matchingTokens[0]?.value ?? input.value,
  });

  return true;
}

function relabelReachableRevenueEstimate({
  budget,
  record,
  stripped,
  tokens,
}: {
  budget?: InlineMarkerBudget;
  record: Record<string, unknown>;
  stripped: StrippedNumericClaim[];
  tokens: readonly UnsupportedNumericToken[];
}): void {
  const value = record.reachableRevenueEstimate;

  if (typeof value !== "string") {
    return;
  }

  const marked = appendMarkerActions({
    budget,
    field: `${bottomUpTamPath}.reachableRevenueEstimate`,
    stripped,
    tokens,
    value,
  });
  const withEvidenceGap = /evidence\s+gap/i.test(marked)
    ? marked
    : `evidence gap: ${marked}`;

  if (withEvidenceGap !== value) {
    record.reachableRevenueEstimate = withEvidenceGap;
  }
}

function relabelBottomUpTamRecord({
  budget,
  path,
  record,
  stripped,
  tokens,
}: {
  budget?: InlineMarkerBudget;
  path: string;
  record: Record<string, unknown>;
  stripped: StrippedNumericClaim[];
  tokens: readonly UnsupportedNumericToken[];
}): void {
  if (path !== bottomUpTamPath || !Array.isArray(record.inputs)) {
    return;
  }

  let relabeledInput = false;
  record.inputs.forEach((input, index) => {
    if (!isRecord(input)) {
      return;
    }

    relabeledInput =
      relabelBottomUpTamInput({
        input,
        path: `${path}.inputs[${index}]`,
        stripped,
        tokens,
      }) || relabeledInput;
  });

  if (relabeledInput) {
    relabelReachableRevenueEstimate({ budget, record, stripped, tokens });
  }
}

function moneyValueKey(fieldName: string): string {
  return `${fieldName}Value`;
}

function moneyProvenanceKey(fieldName: string): string {
  return `${fieldName}Provenance`;
}

function isMoneyDisplayValue({
  fieldName,
  value,
}: {
  fieldName: string;
  value: string;
}): boolean {
  return (
    /[$£€]/.test(value) ||
    /(budget|spend|cost|cpc|cpl|cac)/i.test(fieldName)
  );
}

function isPaidMediaMoneyDisplayField({
  fieldName,
  record,
  value,
}: {
  fieldName: string;
  record: Record<string, unknown>;
  value: unknown;
}): boolean {
  if (typeof value !== "string" || !isMoneyDisplayValue({ fieldName, value })) {
    return false;
  }

  return (
    hasOwn(record, moneyProvenanceKey(fieldName)) ||
    hasOwn(record, moneyValueKey(fieldName))
  );
}

function redactPaidMediaMoneyFields({
  path,
  record,
  stripped,
  tokens,
}: {
  path: string;
  record: Record<string, unknown>;
  stripped: StrippedNumericClaim[];
  tokens: readonly UnsupportedNumericToken[];
}): void {
  for (const [fieldName, value] of Object.entries(record)) {
    if (
      typeof value !== "string" ||
      isDemandIntentKeywordNumericSibling({
        fieldName,
        path: `${path}.${fieldName}`,
      }) ||
      !isPaidMediaMoneyDisplayField({ fieldName, record, value })
    ) {
      continue;
    }

    const matchingTokens = matchingUnsupportedTokens({ tokens, value });

    if (matchingTokens.length === 0) {
      continue;
    }

    const provenanceKey = moneyProvenanceKey(fieldName);
    const numericValueKey = moneyValueKey(fieldName);
    const provenance = record[provenanceKey];

    if (
      typeof provenance === "string" &&
      trustedPaidMediaMoneyProvenances.has(provenance)
    ) {
      continue;
    }

    let changed = false;

    if (record[provenanceKey] !== "unknown") {
      record[provenanceKey] = "unknown";
      changed = true;
    }

    if (hasOwn(record, numericValueKey)) {
      delete record[numericValueKey];
      changed = true;
    }

    if (!changed) {
      continue;
    }

    matchingTokens.forEach((token) => {
      stripped.push({
        action: "provenance-unknown",
        field: `${path}.${fieldName}`,
        value: token.value,
      });
    });
  }
}

function isInsideRawSourceSamples(path: string): boolean {
  return /(^|\.|\])rawSourceSamples(\.|\[|$)/.test(path);
}

function isDemandIntentKeywordNumericSibling({
  fieldName,
  path,
}: {
  fieldName: string;
  path: string;
}): boolean {
  return (
    path.includes("body.keywordDemand.keywords[") &&
    demandIntentKeywordNumericFieldNames.has(fieldName.toLowerCase())
  );
}

function shouldSkipNumericMarkerField({
  fieldName,
  path,
}: {
  fieldName: string;
  path: string;
}): boolean {
  const normalized = fieldName.toLowerCase();

  return (
    normalized.endsWith("url") ||
    normalized === "verbatimtext" ||
    normalized.includes("quote") ||
    normalized === "rawsourcesamples" ||
    isInsideRawSourceSamples(path) ||
    isDemandIntentKeywordNumericSibling({ fieldName, path })
  );
}

function walkBodyForUnsupportedNumerics({
  budget,
  path,
  stripped,
  tokens,
  value,
}: {
  budget: InlineMarkerBudget;
  path: string;
  stripped: StrippedNumericClaim[];
  tokens: readonly UnsupportedNumericToken[];
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkBodyForUnsupportedNumerics({
        budget,
        path: `${path}[${index}]`,
        stripped,
        tokens,
        value: item,
      });
    });
    return;
  }

  if (!isRecord(value) || isInsideRawSourceSamples(path)) {
    return;
  }

  relabelBottomUpTamRecord({ budget, path, record: value, stripped, tokens });
  redactPaidMediaMoneyFields({ path, record: value, stripped, tokens });

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (key === "rawSourceSamples") {
      continue;
    }

    if (typeof childValue === "string") {
      if (
        shouldSkipNumericMarkerField({ fieldName: key, path: childPath }) ||
        isPaidMediaMoneyDisplayField({
          fieldName: key,
          record: value,
          value: childValue,
        })
      ) {
        continue;
      }

      const verifiedMarkerStrip = stripModelAuthoredVerifiedMarkers({
        field: childPath,
        value: childValue,
      });
      stripped.push(...verifiedMarkerStrip.stripped);

      const marked = appendMarkerActions({
        budget,
        field: childPath,
        stripped,
        tokens,
        value: verifiedMarkerStrip.value,
      });

      if (marked !== childValue) {
        value[key] = marked;
      }

      continue;
    }

    walkBodyForUnsupportedNumerics({
      budget,
      path: childPath,
      stripped,
      tokens,
      value: childValue,
    });
  }
}

export function redactUnsupportedNumericClaims({
  body,
  verification,
}: {
  body: Record<string, unknown>;
  verification: VerificationReport;
}): RedactUnsupportedNumericClaimsResult {
  const tokens = collectUnsupportedNumericTokens(verification);

  if (
    tokens.length === 0 &&
    !modelAuthoredVerifiedMarkerProbePattern.test(JSON.stringify(body))
  ) {
    return { body, stripped: [] };
  }

  const cloned = structuredClone(body);
  const stripped: StrippedNumericClaim[] = [];
  const budget: InlineMarkerBudget = {
    remaining: inlineMarkerBudgetPerSection,
  };

  walkBodyForUnsupportedNumerics({
    budget,
    path: "body",
    stripped,
    tokens,
    value: cloned,
  });

  return stripped.length === 0 ? { body, stripped } : { body: cloned, stripped };
}

export function getMaxUnsupportedAllowed(
  env: Record<string, string | undefined> = {},
): number {
  const rawValue = env[verifierMaxUnsupportedEnvKey]?.trim();

  if (rawValue === undefined || rawValue.length === 0) {
    return defaultMaxUnsupportedAllowed;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    return defaultMaxUnsupportedAllowed;
  }

  return value;
}

/**
 * Evidence-grounded confidence: verifiedCount / (verifiedCount + unsupportedCount).
 * Replaces the model's self-reported confidence (which is uncorrelated with
 * grounding). Falls back to 0.0 when the verifier extracted zero claims — i.e.
 * nothing could be grounded, so confidence is not earned.
 */
export function deriveGroundedConfidence(report: {
  verifiedCount: number;
  unsupportedCount: number;
}, shortfall?: EvidenceSupportShortfall): number {
  const provenancePenalty = shortfall?.provenanceFlags.length ?? 0;
  const total =
    report.verifiedCount + report.unsupportedCount + provenancePenalty;

  if (total === 0) {
    return 0;
  }

  return report.verifiedCount / total;
}
