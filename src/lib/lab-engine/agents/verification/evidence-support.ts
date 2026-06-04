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

export interface EvidenceSupportShortfall {
  unsupportedLoadBearing: UnsupportedLoadBearingClaim[];
  issues: string[];
}

export interface EvaluateEvidenceSupportInput {
  verification: VerificationReport;
  loadBearingKinds?: readonly LoadBearingClaimKind[];
}

const defaultLoadBearingKinds = ["numeric", "url"] as const;
// Paid-media plans legitimately project many model-derived numbers; gating them
// on numeric claims would false-fail. Scope the plan's load-bearing set to URLs
// so an unsourced citation fails the gate but plan numbers do not.
export const paidMediaLoadBearingKinds = ["url"] as const;
// Voice-of-Customer is quote-first: a fabricated or self-sourced verbatim is the
// section's defining failure mode, so quotes join numerics and URLs as load-bearing.
export const voiceOfCustomerLoadBearingKinds = [
  "numeric",
  "url",
  "quote",
] as const;
const verifierMaxUnsupportedEnvKey = "LAB_VERIFIER_MAX_UNSUPPORTED";
// Default OPEN (Infinity): the evidence gate is advisory unless an operator sets
// LAB_VERIFIER_MAX_UNSUPPORTED to a finite integer. A finite default would hard-fail
// most sections after repairs (the verifier is substring-match, ~65% verified on real
// runs) and revive the per-section repair storm. Low-confidence sections are surfaced
// for review via grounded confidence at commit time, not by deleting the section here.
const defaultMaxUnsupportedAllowed = Infinity;

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
}): number {
  const total = report.verifiedCount + report.unsupportedCount;

  if (total === 0) {
    return 0;
  }

  return report.verifiedCount / total;
}
