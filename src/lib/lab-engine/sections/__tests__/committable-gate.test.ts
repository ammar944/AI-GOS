import { describe, expect, it } from "vitest";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../../artifacts/artifact-envelope";
import type { SectionId } from "../../events/activity-event";
import { marketCategoryFixtureArtifact } from "../../fixtures/market-category-artifact";
import type { LoadBearingClaimKind } from "../../agents/verification/evidence-support";
import type { VerificationReport } from "../../agents/verification/types";
import {
  evaluateCommittableAttempt,
  type CommittableSectionDefinition,
} from "../committable-gate";
import type { RequiredEvidenceClass } from "../required-evidence";
import { NOT_PROBED_THIS_RUN_PHRASE } from "../sentinels";

function buildArtifact({
  body = marketCategoryFixtureArtifact.body,
  sectionId = "positioningMarketCategory",
}: {
  body?: Record<string, unknown>;
  sectionId?: SectionId;
} = {}): ArtifactEnvelope {
  return artifactEnvelopeSchema.parse({
    ...marketCategoryFixtureArtifact,
    body,
    id: `artifact_${sectionId}`,
    sectionId,
  });
}

// Mirrors the per-section load-bearing kinds the registry now carries (was the
// gate's getLoadBearingKindsForSection). Keeps every existing call site working
// while the gate reads definition.loadBearingKinds. The registry values are
// independently pinned by section-registry.test.ts.
function defaultLoadBearingKindsFor(
  sectionId: SectionId,
): readonly LoadBearingClaimKind[] {
  if (sectionId === "positioningPaidMediaPlan") {
    return ["url"];
  }
  if (sectionId === "positioningVoiceOfCustomer") {
    return ["numeric", "url", "quote"];
  }
  return ["numeric", "url"];
}

function buildDefinition({
  errors = [],
  requiredEvidenceClasses = [],
  sectionId = "positioningMarketCategory",
  loadBearingKinds = defaultLoadBearingKindsFor(sectionId),
}: {
  errors?: string[];
  requiredEvidenceClasses?: readonly RequiredEvidenceClass[];
  sectionId?: SectionId;
  loadBearingKinds?: readonly LoadBearingClaimKind[];
} = {}): CommittableSectionDefinition {
  return {
    id: sectionId,
    requiredEvidenceClasses,
    loadBearingKinds,
    validateMinimums: (): { ok: boolean; errors: string[] } => ({
      ok: errors.length === 0,
      errors,
    }),
  };
}

function buildVerificationReport(
  claims: VerificationReport["claims"] = [],
): VerificationReport {
  return {
    claims,
    unsupportedCount: claims.filter((claim) => claim.status === "unsupported")
      .length,
    verifiedCount: claims.filter((claim) => claim.status === "verified").length,
  };
}

function unsupportedClaim(
  kind: "numeric" | "quote" | "url",
  value: string,
): VerificationReport["claims"][number] {
  return {
    claim: {
      kind,
      raw: value,
      value,
    },
    reason: "no_match",
    status: "unsupported",
  };
}

function verifiedQuoteAttributionClaim(): VerificationReport["claims"][number] {
  return {
    claim: {
      assertedSource: "G2",
      assertedSourceUrl: "https://baserow.io/reviews",
      kind: "quoteAttribution",
      raw: "missing table stakes",
      value: "missing table stakes",
    },
    entailmentVerdict: "supported",
    matchedSourceRef: {
      excerptIndex: 0,
      kind: "corpusExcerpt",
      sourceUrl: "https://baserow.io/reviews",
    },
    status: "verified",
  };
}

describe("evaluateCommittableAttempt", (): void => {
  it("returns minimumsFailed before required evidence or hooks", (): void => {
    const artifact = buildArtifact();
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition({
        errors: ["missing minimum fixture field"],
        requiredEvidenceClasses: ["marketCategory_name"],
      }),
      env: {},
      postRequiredEvidenceHook: () => {
        throw new Error("hook should not run after minimum failure");
      },
      verification: buildVerificationReport(),
    });

    expect(verdict).toEqual({
      kind: "minimumsFailed",
      errors: ["missing minimum fixture field"],
    });
  });

  it("returns requiredEvidenceMissing with verification counts", (): void => {
    const artifact = buildArtifact({
      body: {
        categoryDefinition: {
          adjacentCategories: [],
        },
      },
    });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition({
        requiredEvidenceClasses: ["marketCategory_name"],
      }),
      env: {},
      verification: buildVerificationReport([
        unsupportedClaim("numeric", "$99/mo"),
      ]),
    });

    expect(verdict).toEqual({
      kind: "requiredEvidenceMissing",
      missingClass: "marketCategory_name",
      unsupportedCount: 1,
      verifiedCount: 0,
    });
  });

  it("passes the injected env into required evidence checks", (): void => {
    const artifact = buildArtifact({
      body: {
        adEvidence: {
          advertiserGroups: [
            {
              creatives: [],
              dataGaps: [
                {
                  platform: "linkedin",
                  reason: `LinkedIn ad library was ${NOT_PROBED_THIS_RUN_PHRASE}; LinkedIn counts are structurally 0.`,
                },
              ],
              displayableTotal: 0,
              rawSourceSamples: [{ id: "raw_1" }],
              returnedCreativeCount: 0,
              sourceErrors: [],
            },
          ],
        },
      },
      sectionId: "positioningCompetitorLandscape",
    });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition({
        requiredEvidenceClasses: ["adEvidence_or_gap"],
        sectionId: "positioningCompetitorLandscape",
      }),
      env: { LAB_AD_EVIDENCE_STRICT: "true" },
      verification: buildVerificationReport(),
    });

    expect(verdict).toMatchObject({
      kind: "requiredEvidenceMissing",
      missingClass: "adEvidence_or_gap",
    });
  });

  it("returns hookReject with the hook gap artifact", (): void => {
    const artifact = buildArtifact();
    const gapArtifact = buildArtifact({
      body: {
        evidenceGap: true,
      },
    });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition(),
      env: {},
      postRequiredEvidenceHook: () => ({
        kind: "reject",
        errors: ["self-sourced quote"],
        gapArtifact,
      }),
      verification: buildVerificationReport(),
    });

    expect(verdict).toEqual({
      kind: "hookReject",
      errors: ["self-sourced quote"],
      gapArtifact,
    });
  });

  it("keeps softenFailed as a terminal hook rejection with specific errors", (): void => {
    const artifact = buildArtifact();
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition(),
      env: {},
      postRequiredEvidenceHook: () => ({
        kind: "softenFailed",
        errors: ["DemandIntent SpyFu ToolGap softening did not re-pass validation"],
      }),
      verification: buildVerificationReport(),
    });

    expect(verdict).toEqual({
      kind: "hookReject",
      errors: ["DemandIntent SpyFu ToolGap softening did not re-pass validation"],
    });
  });

  it("returns the softened artifact when the hook repairs the candidate", (): void => {
    const artifact = buildArtifact();
    const softenedArtifact = buildArtifact({
      body: {
        ...artifact.body,
        evidenceGap: true,
      },
    });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition(),
      env: {},
      postRequiredEvidenceHook: () => ({
        kind: "soften",
        artifact: softenedArtifact,
      }),
      verification: buildVerificationReport(),
    });

    expect(verdict).toEqual({
      kind: "committable",
      committableArtifact: softenedArtifact,
    });
  });

  it("uses default numeric and url load-bearing claims for ordinary sections", (): void => {
    const artifact = buildArtifact();
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition(),
      env: {},
      verification: buildVerificationReport([
        unsupportedClaim("numeric", "$99/mo"),
        unsupportedClaim("quote", "made up quote"),
      ]),
    });

    expect(verdict.kind).toBe("evidenceShortfall");
    if (verdict.kind !== "evidenceShortfall") {
      throw new Error("expected evidence shortfall");
    }
    expect(
      verdict.shortfall.unsupportedLoadBearing.map(
        (claim) => claim.claim.kind,
      ),
    ).toEqual(["numeric"]);
  });

  it("scopes paid-media load-bearing claims to urls only", (): void => {
    const artifact = buildArtifact({
      sectionId: "positioningPaidMediaPlan",
    });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition({
        sectionId: "positioningPaidMediaPlan",
      }),
      env: {},
      verification: buildVerificationReport([
        unsupportedClaim("numeric", "$99/mo"),
        unsupportedClaim("url", "https://fabricated.example/pricing"),
      ]),
    });

    expect(verdict.kind).toBe("evidenceShortfall");
    if (verdict.kind !== "evidenceShortfall") {
      throw new Error("expected evidence shortfall");
    }
    expect(
      verdict.shortfall.unsupportedLoadBearing.map(
        (claim) => claim.claim.kind,
      ),
    ).toEqual(["url"]);
  });

  it("treats VoC quote claims as load-bearing", (): void => {
    const artifact = buildArtifact({
      sectionId: "positioningVoiceOfCustomer",
    });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition({
        sectionId: "positioningVoiceOfCustomer",
      }),
      env: {},
      verification: buildVerificationReport([
        unsupportedClaim("quote", "fabricated buyer language"),
      ]),
    });

    expect(verdict.kind).toBe("evidenceShortfall");
    if (verdict.kind !== "evidenceShortfall") {
      throw new Error("expected evidence shortfall");
    }
    expect(
      verdict.shortfall.unsupportedLoadBearing.map(
        (claim) => claim.claim.kind,
      ),
    ).toEqual(["quote"]);
  });

  it("keeps flag-only provenance shortfall on the committable verdict", (): void => {
    const artifact = buildArtifact({
      sectionId: "positioningCompetitorLandscape",
    });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition({
        sectionId: "positioningCompetitorLandscape",
      }),
      env: {},
      verification: buildVerificationReport([verifiedQuoteAttributionClaim()]),
    });

    expect(verdict.kind).toBe("committable");
    if (verdict.kind !== "committable") {
      throw new Error("expected committable verdict");
    }
    expect(verdict.shortfall).toEqual(
      expect.objectContaining({
        provenanceFlags: [
          expect.objectContaining({
            reason: "misattributed",
            value: "missing table stakes",
          }),
        ],
        unsupportedLoadBearing: [],
      }),
    );
  });

  it("keeps provenance flags advisory when unsupported claims remain within the open gate posture", (): void => {
    const artifact = buildArtifact();
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition(),
      env: {},
      verification: buildVerificationReport([
        unsupportedClaim("numeric", "$99/mo"),
        verifiedQuoteAttributionClaim(),
      ]),
    });

    expect(verdict.kind).toBe("evidenceShortfall");
    if (verdict.kind !== "evidenceShortfall") {
      throw new Error("expected evidence shortfall");
    }
    expect(verdict.shortfall.unsupportedLoadBearing).toHaveLength(1);
    expect(verdict.shortfall.provenanceFlags).toEqual([
      expect.objectContaining({
        reason: "misattributed",
        value: "missing table stakes",
      }),
    ]);
  });
});
