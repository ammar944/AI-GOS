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
  computedTrustConfidence?: number;
}

export interface EvaluateEvidenceSupportInput {
  verification: VerificationReport;
  loadBearingKinds?: readonly LoadBearingClaimKind[];
  // Downgrade-not-delete posture (§4.6): when true, the run-level gate counts
  // only affirmatively-refuted load-bearing claims — never inference (no_match
  // with no source) or unreachable (kept-and-downgraded rows). A no_match claim
  // is kept-and-labelled by the verifier, not a fabrication to hard-fail on.
  gateRefutedOnly?: boolean;
}

export interface ClaimSupportCounts {
  verifiedCount: number;
  unsupportedCount: number;
}

export interface DeriveClaimSupportCountsForTrustInput {
  body: Record<string, unknown>;
  briefMoneyDigits?: ReadonlySet<string>;
  report: VerificationReport;
  sectionId: string;
}

const defaultLoadBearingKinds = ["numeric", "sourceAttribution", "url"] as const;
const verifierMaxUnsupportedEnvKey = "LAB_VERIFIER_MAX_UNSUPPORTED";
// Default closed: live runs may raise this with LAB_VERIFIER_MAX_UNSUPPORTED,
// but unset/empty/invalid values must not silently make the gate advisory.
const defaultMaxUnsupportedAllowed = 0;
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
  gateRefutedOnly = false,
  loadBearingKinds = defaultLoadBearingKinds,
  verification,
}: EvaluateEvidenceSupportInput): EvidenceSupportShortfall {
  const loadBearingKindSet = new Set<Claim["kind"]>(loadBearingKinds);
  const unsupportedLoadBearing = verification.claims
    .filter((verdict) => isUnsupportedLoadBearingClaim(verdict, loadBearingKindSet))
    .filter((verdict) => !gateRefutedOnly || verdict.entailmentVerdict === "refuted");

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
  | "recorded"
  | "evidence-gap"
  | "provenance-unknown"
  | "provenance-downgraded"
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

const modelAuthoredVerifiedMarkerPattern =
  /\s*\[\s*verified\b[^\]\n]{0,160}\]/giu;
const modelAuthoredVerifiedMarkerProbePattern =
  /\[\s*verified\b[^\]\n]{0,160}\]/iu;
// Unconditionally trusted money provenances. "user-supplied" is NOT here: the
// label is model-asserted, so it only earns the exemption when the figure
// actually appears in the brief economics (see briefMoneyDigits below) —
// otherwise it is downgraded to "model-estimated".
const trustedPaidMediaMoneyProvenances = new Set([
  "tool-measured",
  "source-reported",
  // Safe because "derived" is code-written only: paid-media schema snapping
  // converts model-asserted "derived" to "model-estimated", and the budget
  // cascade reconciler is the sole writer of the committed derived token.
  "derived",
]);
const claimSupportPaidMediaMoneyProvenances = new Set(["derived"]);
const userSuppliedMoneyProvenance = "user-supplied";
const modelEstimatedMoneyProvenance = "model-estimated";
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

// A token only counts as PRESENT in a field at a clean token boundary. A raw
// substring match inside a longer word or number is a different figure — the
// historic `$450/mo` inside `$450/month` defect — so embedded matches are
// skipped: the claim stays unsupported in the verification report and the
// badge covers it.
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

function tokenPresentAtCleanBoundary({
  token,
  value,
}: {
  token: UnsupportedNumericToken;
  value: string;
}): boolean {
  if (token.value.length === 0 || !value.includes(token.value)) {
    return false;
  }

  const pattern = new RegExp(escapeRegExp(token.value), "g");
  let match = pattern.exec(value);

  while (match !== null) {
    if (
      isCleanTokenBoundary({
        matchLength: match[0].length,
        offset: match.index,
        source: value,
      })
    ) {
      return true;
    }

    match = pattern.exec(value);
  }

  return false;
}

// The verifier never writes into the deliverable: unsupported figures are
// RECORDED in verifierSummary.strippedNumericClaims (exact field paths) and
// surfaced through the needs_review badge — the body string ships unchanged.
// The previous behavior spliced inline `[unverified]` markers and aggregate
// footnotes into committed prose, which every downstream consumer (executive
// brief input, paid-media research input, share, profile) inherited.
function recordUnsupportedNumericTokens({
  field,
  stripped,
  tokens,
  value,
}: {
  field: string;
  stripped: StrippedNumericClaim[];
  tokens: readonly UnsupportedNumericToken[];
  value: string;
}): void {
  for (const token of tokens) {
    if (tokenPresentAtCleanBoundary({ token, value })) {
      stripped.push({
        action: "recorded",
        field,
        value: token.value,
      });
    }
  }
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

// Prefixes the estimate with the evidence-gap label when any recipe input was
// relabeled. Unsupported tokens inside the estimate are recorded by the
// generic body walk — no separate record here.
function relabelReachableRevenueEstimate(
  record: Record<string, unknown>,
): void {
  const value = record.reachableRevenueEstimate;

  if (typeof value !== "string" || /evidence\s+gap/i.test(value)) {
    return;
  }

  record.reachableRevenueEstimate = `evidence gap: ${value}`;
}

function relabelBottomUpTamRecord({
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
    relabelReachableRevenueEstimate(record);
  }
}

// Digit-normal forms of every number in a string: commas stripped, K/M/B
// magnitudes expanded ("$3,000" -> "3000"; "5k" -> "5" and "5000"). Used to
// check whether a model-claimed "user-supplied" money figure actually appears
// in the brief economics.
export function moneyDigitVariants(value: string): string[] {
  const variants: string[] = [];

  for (const match of value.matchAll(/\d[\d,]*(?:\.\d+)?\s?(?:[kmb]\b)?/gi)) {
    const raw = match[0].trim();
    const magnitudeMatch = /^([\d,.]+)\s?([kmb])$/i.exec(raw);
    const digits = raw.replace(/[\s,]/g, "").replace(/[kmb]$/i, "");

    if (digits.length > 0) {
      variants.push(digits);
    }

    if (magnitudeMatch !== null) {
      const base = Number.parseFloat(magnitudeMatch[1].replace(/,/g, ""));
      const multiplier = suffixMultipliers[magnitudeMatch[2].toLowerCase()];

      if (Number.isFinite(base) && multiplier !== undefined) {
        variants.push(String(Math.round(base * multiplier)));
      }
    }
  }

  return variants;
}

const suffixMultipliers: Record<string, number> = {
  b: 1_000_000_000,
  k: 1_000,
  m: 1_000_000,
};

/**
 * Digit-normal index of every money/number figure the operator actually
 * supplied in the brief economics. A paid-media money field may only claim
 * "user-supplied" provenance for figures present here.
 */
export function collectBriefMoneyDigits(economics: unknown): ReadonlySet<string> {
  const digits = new Set<string>();

  if (!isRecord(economics)) {
    return digits;
  }

  for (const value of Object.values(economics)) {
    if (typeof value !== "string") {
      continue;
    }

    for (const variant of moneyDigitVariants(value)) {
      digits.add(variant);
    }
  }

  return digits;
}

function tokenAppearsInBriefEconomics({
  briefMoneyDigits,
  token,
}: {
  briefMoneyDigits: ReadonlySet<string>;
  token: string;
}): boolean {
  return moneyDigitVariants(token).some((variant) =>
    briefMoneyDigits.has(variant),
  );
}

// Significant money tokens are magnitude-resolved or multi-digit variants
// (e.g. "1000", "10000", "4200") — NOT bare 1–3 digit tokens like "20" that a
// percentage or count elsewhere in the brief would coincidentally share.
const SIGNIFICANT_MONEY_TOKEN_MIN_LENGTH = 4;

function significantMoneyTokens(value: string): string[] {
  // Brief select-values encode a range with an underscore ("1k_10k"). The
  // underscore is a \w char, so it suppresses the magnitude word-boundary in
  // moneyDigitVariants and the first endpoint never resolves ("1k" → "1", not
  // "1000"). Treat it as the range separator it is before tokenizing.
  return moneyDigitVariants(value.replace(/_/g, " ")).filter(
    (variant) => variant.length >= SIGNIFICANT_MONEY_TOKEN_MIN_LENGTH,
  );
}

// True when every significant money token in `value` appears in the operator
// brief economics. An operator-supplied number (ACV, CAC, LTV, budget) is
// honestly user_asserted even when the section prose formats it differently
// (en-dash range, "$"/"k" vs the stored "1k_10k"). An invented magnitude
// ($20B TAM, a CAC not in the brief) shares no significant token and stays
// unsupported — the gate is not laundered by a bare small-digit collision.
export function numericValueIsBriefEconomicsSupported(
  value: string,
  economics: unknown,
): boolean {
  const claimTokens = significantMoneyTokens(value);

  if (claimTokens.length === 0) {
    return false;
  }

  const briefTokens = new Set<string>();

  if (isRecord(economics)) {
    for (const briefValue of Object.values(economics)) {
      if (typeof briefValue !== "string") {
        continue;
      }

      for (const token of significantMoneyTokens(briefValue)) {
        briefTokens.add(token);
      }
    }
  }

  return claimTokens.every((token) => briefTokens.has(token));
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
  briefMoneyDigits,
  path,
  record,
  stripped,
  tokens,
}: {
  briefMoneyDigits: ReadonlySet<string>;
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

    if (provenance === userSuppliedMoneyProvenance) {
      // "user-supplied" is a model-asserted label: it only earns the
      // exemption when the figure actually appears in the brief economics.
      // Otherwise the provenance is downgraded to "model-estimated" — the
      // display string and numeric value stay.
      const earned = matchingTokens.every((token) =>
        tokenAppearsInBriefEconomics({ briefMoneyDigits, token: token.value }),
      );

      if (earned) {
        continue;
      }

      record[provenanceKey] = modelEstimatedMoneyProvenance;
      matchingTokens.forEach((token) => {
        stripped.push({
          action: "provenance-downgraded",
          field: `${path}.${fieldName}`,
          value: token.value,
        });
      });
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
  briefMoneyDigits,
  path,
  stripped,
  tokens,
  value,
}: {
  briefMoneyDigits: ReadonlySet<string>;
  path: string;
  stripped: StrippedNumericClaim[];
  tokens: readonly UnsupportedNumericToken[];
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkBodyForUnsupportedNumerics({
        briefMoneyDigits,
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

  relabelBottomUpTamRecord({ path, record: value, stripped, tokens });
  redactPaidMediaMoneyFields({
    briefMoneyDigits,
    path,
    record: value,
    stripped,
    tokens,
  });

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

      recordUnsupportedNumericTokens({
        field: childPath,
        stripped,
        tokens,
        value: verifiedMarkerStrip.value,
      });

      if (verifiedMarkerStrip.value !== childValue) {
        value[key] = verifiedMarkerStrip.value;
      }

      continue;
    }

    walkBodyForUnsupportedNumerics({
      briefMoneyDigits,
      path: childPath,
      stripped,
      tokens,
      value: childValue,
    });
  }
}

export function redactUnsupportedNumericClaims({
  body,
  briefMoneyDigits = new Set<string>(),
  verification,
}: {
  body: Record<string, unknown>;
  briefMoneyDigits?: ReadonlySet<string>;
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

  walkBodyForUnsupportedNumerics({
    briefMoneyDigits,
    path: "body",
    stripped,
    tokens,
    value: cloned,
  });

  return stripped.length === 0 ? { body, stripped } : { body: cloned, stripped };
}

const paidMediaRecommendationPathPatterns = [
  /^body\.channelSuggestions\[\d+\]\.recommendation$/,
  /^body\.campaignPhases\[\d+\]\.bullets\[\d+\]$/,
  /^body\.anglesToTest\[\d+\]\.description$/,
  /^body\.funnelIdeation\[\d+\]\.description$/,
  /^body\.funnelIdeation\[\d+\]\.whatItProves$/,
] as const;
const paidMediaPlanActionVerbs = [
  "add",
  "allocate",
  "cap",
  "cut",
  "decrease",
  "hold",
  "increase",
  "launch",
  "lower",
  "move",
  "pause",
  "prioritize",
  "raise",
  "reallocate",
  "reduce",
  "reserve",
  "route",
  "scale",
  "shift",
  "split",
  "start",
  "stop",
  "test",
] as const;
const paidMediaPlanActionVerbSource = paidMediaPlanActionVerbs.join("|");
const paidMediaPlanImperativePattern = new RegExp(
  `^(?:${paidMediaPlanActionVerbSource})\\b`,
  "i",
);
const paidMediaPlanConditionalActionPattern = new RegExp(
  `^(?:if|when)\\b.{0,160}\\b(?:${paidMediaPlanActionVerbSource})\\b`,
  "i",
);
const sentenceSplitPattern = /(?<=[.!?])\s+/;

function isPaidMediaRecommendationPath(path: string): boolean {
  return paidMediaRecommendationPathPatterns.some((pattern) =>
    pattern.test(path),
  );
}

function isPaidMediaPlanPrescription(value: string): boolean {
  const normalized = normalizeWhitespace(value);

  return (
    paidMediaPlanImperativePattern.test(normalized) ||
    paidMediaPlanConditionalActionPattern.test(normalized)
  );
}

function claimTokenAppearsInText({
  token,
  value,
}: {
  token: string;
  value: string;
}): boolean {
  return sentenceHasClaimToken({ sentence: value, token });
}

function sentenceHasClaimToken({
  sentence,
  token,
}: {
  sentence: string;
  token: string;
}): boolean {
  if (!sentence.includes(token)) {
    return false;
  }

  const pattern = new RegExp(escapeRegExp(token), "g");
  let match = pattern.exec(sentence);

  while (match !== null) {
    if (
      isCleanTokenBoundary({
        matchLength: match[0].length,
        offset: match.index,
        source: sentence,
      })
    ) {
      return true;
    }

    match = pattern.exec(sentence);
  }

  return false;
}

function valueHasPrescriptiveClaimToken({
  token,
  value,
}: {
  token: string;
  value: string;
}): boolean {
  return value
    .split(sentenceSplitPattern)
    .map(normalizeWhitespace)
    .filter((sentence) => sentence.length > 0)
    .some(
      (sentence) =>
        sentenceHasClaimToken({ sentence, token }) &&
        isPaidMediaPlanPrescription(sentence),
    );
}

function collectPaidMediaPrescriptionFields({
  body,
}: {
  body: Record<string, unknown>;
}): string[] {
  const fields: string[] = [];

  function visit(value: unknown, path: string): void {
    if (typeof value === "string") {
      if (isPaidMediaRecommendationPath(path)) {
        fields.push(value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const [key, childValue] of Object.entries(value)) {
      visit(childValue, `${path}.${key}`);
    }
  }

  visit(body, "body");

  return fields;
}

function addMoneyDigitVariants({
  digits,
  value,
}: {
  digits: Set<string>;
  value: string;
}): void {
  moneyDigitVariants(value).forEach((variant) => {
    digits.add(variant);
  });
}

function collectPaidMediaOwnMoneyDigits({
  body,
  briefMoneyDigits,
}: {
  body: Record<string, unknown>;
  briefMoneyDigits: ReadonlySet<string>;
}): ReadonlySet<string> {
  const digits = new Set<string>();

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const [fieldName, fieldValue] of Object.entries(value)) {
      if (
        typeof fieldValue !== "string" ||
        !isPaidMediaMoneyDisplayField({
          fieldName,
          record: value,
          value: fieldValue,
        })
      ) {
        continue;
      }

      const provenance = value[moneyProvenanceKey(fieldName)];

      if (
        typeof provenance === "string" &&
        claimSupportPaidMediaMoneyProvenances.has(provenance)
      ) {
        addMoneyDigitVariants({ digits, value: fieldValue });
        continue;
      }

      if (
        provenance === userSuppliedMoneyProvenance &&
        tokenAppearsInBriefEconomics({
          briefMoneyDigits,
          token: fieldValue,
        })
      ) {
        addMoneyDigitVariants({ digits, value: fieldValue });
      }
    }

    Object.values(value).forEach(visit);
  }

  visit(body);

  return digits;
}

function tokenAppearsInMoneyDigits({
  digits,
  token,
}: {
  digits: ReadonlySet<string>;
  token: string;
}): boolean {
  return moneyDigitVariants(token).some((variant) => digits.has(variant));
}

function isPaidMediaTrustExemptUnsupportedClaim({
  briefMoneyDigits,
  claim,
  ownMoneyDigits,
  prescriptionFields,
}: {
  briefMoneyDigits: ReadonlySet<string>;
  claim: Claim;
  ownMoneyDigits: ReadonlySet<string>;
  prescriptionFields: readonly string[];
}): boolean {
  if (!isNumericClaim(claim)) {
    return false;
  }

  if (
    tokenAppearsInBriefEconomics({
      briefMoneyDigits,
      token: claim.value,
    })
  ) {
    return true;
  }

  if (tokenAppearsInMoneyDigits({ digits: ownMoneyDigits, token: claim.value })) {
    return true;
  }

  return prescriptionFields.some((fieldValue) => {
    if (normalizeWhitespace(fieldValue) !== normalizeWhitespace(claim.raw)) {
      return false;
    }

    if (!claimTokenAppearsInText({ token: claim.value, value: fieldValue })) {
      return false;
    }

    return valueHasPrescriptiveClaimToken({
      token: claim.value,
      value: fieldValue,
    });
  });
}

export function deriveClaimSupportCountsForTrust({
  body,
  briefMoneyDigits = new Set<string>(),
  report,
  sectionId,
}: DeriveClaimSupportCountsForTrustInput): ClaimSupportCounts {
  if (sectionId !== "positioningPaidMediaPlan") {
    return {
      unsupportedCount: report.unsupportedCount,
      verifiedCount: report.verifiedCount,
    };
  }

  const ownMoneyDigits = collectPaidMediaOwnMoneyDigits({
    body,
    briefMoneyDigits,
  });
  const prescriptionFields = collectPaidMediaPrescriptionFields({ body });
  const exemptUnsupportedCount = report.claims.filter(
    (verdict) =>
      verdict.status === "unsupported" &&
      isPaidMediaTrustExemptUnsupportedClaim({
        briefMoneyDigits,
        claim: verdict.claim,
        ownMoneyDigits,
        prescriptionFields,
      }),
  ).length;

  return {
    unsupportedCount: Math.max(
      0,
      report.unsupportedCount - exemptUnsupportedCount,
    ),
    verifiedCount: report.verifiedCount,
  };
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
  if (shortfall?.computedTrustConfidence !== undefined) {
    return shortfall.computedTrustConfidence;
  }

  const provenancePenalty = shortfall?.provenanceFlags.length ?? 0;
  const total =
    report.verifiedCount + report.unsupportedCount + provenancePenalty;

  if (total === 0) {
    return 0;
  }

  return report.verifiedCount / total;
}
