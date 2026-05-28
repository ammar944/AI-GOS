import type { Claim, ClaimVerdict, VerificationReport } from "./types";

export type LoadBearingClaimKind = Extract<Claim["kind"], "numeric" | "url">;

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
