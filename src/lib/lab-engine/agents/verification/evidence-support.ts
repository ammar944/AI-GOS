import type { Claim, ClaimVerdict, VerificationReport } from "./types";

export type LoadBearingClaimKind = Extract<
  Claim["kind"],
  "numeric" | "url" | "quote"
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

const defaultLoadBearingKinds = ["numeric", "url"] as const;
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
