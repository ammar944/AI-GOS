import { describe, expect, it } from "vitest";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../../artifacts/artifact-envelope";
import type { SectionId } from "../../events/activity-event";
import { marketCategoryFixtureArtifact } from "../../fixtures/market-category-artifact";
import { voiceOfCustomerFixtureArtifact } from "../../fixtures/voice-of-customer-artifact";
import { validateVoiceOfCustomerMinimums } from "../../artifacts/schemas/voice-of-customer";
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
  verifierDowngradeMode = false,
}: {
  errors?: string[];
  requiredEvidenceClasses?: readonly RequiredEvidenceClass[];
  sectionId?: SectionId;
  loadBearingKinds?: readonly LoadBearingClaimKind[];
  verifierDowngradeMode?: boolean;
} = {}): CommittableSectionDefinition {
  return {
    id: sectionId,
    requiredEvidenceClasses,
    loadBearingKinds,
    verifierDowngradeMode,
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

function refutedClaim(
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
    entailmentVerdict: "refuted",
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

function vocBlockGap(summary: string): Record<string, unknown> {
  return {
    summary,
    foundCount: 0,
    requiredCount: 1,
    sourcingPlan: ["Check review, forum, and community sources next run."],
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

  // GOAL (c) / WAVE 0.5 firewall: the count-minimums degrade-commit lives on the
  // `minimumsFailed` verdict branch (committable-gate.ts:92-94). The
  // evidence-support gate lives on a SEPARATE branch (committable-gate.ts:140-152),
  // reached only AFTER minimums pass. So a body that clears the count floors but
  // carries an unsupported load-bearing claim must STILL hard-fail with
  // `evidenceShortfall` — the count-floor degrade path can never reach or swallow
  // this truth gate.
  it("still returns evidenceShortfall for an unsupported load-bearing claim even when minimums pass (degrade path cannot swallow the truth gate)", (): void => {
    const artifact = buildArtifact();
    const verdict = evaluateCommittableAttempt({
      // No minimums errors -> the count-floor degrade path is never entered.
      artifact,
      definition: buildDefinition({ errors: [] }),
      env: {},
      verification: buildVerificationReport([
        unsupportedClaim("numeric", "$4.2B TAM"),
      ]),
    });

    expect(verdict.kind).toBe("evidenceShortfall");
    if (verdict.kind !== "evidenceShortfall") {
      throw new Error("expected evidence shortfall");
    }
    expect(verdict.shortfall.unsupportedLoadBearing).toHaveLength(1);
    expect(verdict.shortfall.unsupportedLoadBearing[0]?.claim.value).toBe(
      "$4.2B TAM",
    );
  });

  it("under verifierDowngradeMode keeps no_match load-bearing claims out of the gate, committing", (): void => {
    const artifact = buildArtifact({ sectionId: "positioningBuyerICP" });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition({
        sectionId: "positioningBuyerICP",
        verifierDowngradeMode: true,
      }),
      env: {},
      verification: buildVerificationReport([
        // Kept-and-downgraded persona URL (unreachable) + directional firmographic
        // numeric — neither is an affirmatively-refuted fabrication.
        unsupportedClaim("url", "https://next.ramp.com/customers/perplexity"),
        unsupportedClaim("numeric", "10–1,000"),
      ]),
    });

    expect(verdict.kind).toBe("committable");
  });

  it("under verifierDowngradeMode still gates an affirmatively-refuted load-bearing claim", (): void => {
    const artifact = buildArtifact({ sectionId: "positioningBuyerICP" });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: buildDefinition({
        sectionId: "positioningBuyerICP",
        verifierDowngradeMode: true,
      }),
      env: {},
      verification: buildVerificationReport([
        unsupportedClaim("url", "https://next.ramp.com/customers/perplexity"),
        refutedClaim("numeric", "$10M ARR"),
      ]),
    });

    expect(verdict.kind).toBe("evidenceShortfall");
    if (verdict.kind !== "evidenceShortfall") {
      throw new Error("expected evidence shortfall");
    }
    expect(
      verdict.shortfall.unsupportedLoadBearing.map((claim) => claim.claim.value),
    ).toEqual(["$10M ARR"]);
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

  it("commits an empty VoC artifact when all quote blocks are gapped with retrievalSummary", (): void => {
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      retrievalSummary:
        "Searched review, forum, and public community surfaces; no admissible customer-authored quotes were retrieved.",
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        quotes: [],
        blockGap: vocBlockGap("No admissible pain language was retrieved."),
      },
      objections: {
        ...voiceOfCustomerFixtureArtifact.body.objections,
        items: [],
        blockGap: vocBlockGap("No admissible objections were retrieved."),
      },
      switchingStories: {
        ...voiceOfCustomerFixtureArtifact.body.switchingStories,
        stories: [],
        blockGap: vocBlockGap("No admissible switching stories were retrieved."),
      },
      decisionCriteria: {
        ...voiceOfCustomerFixtureArtifact.body.decisionCriteria,
        criteria: [],
        blockGap: vocBlockGap("No admissible decision criteria were retrieved."),
      },
      successLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.successLanguage,
        quotes: [],
        blockGap: vocBlockGap("No admissible success language was retrieved."),
      },
    };
    const artifact = buildArtifact({
      body: body as unknown as Record<string, unknown>,
      sectionId: "positioningVoiceOfCustomer",
    });
    const verdict = evaluateCommittableAttempt({
      artifact,
      definition: {
        ...buildDefinition({ sectionId: "positioningVoiceOfCustomer" }),
        validateMinimums: (candidate) =>
          validateVoiceOfCustomerMinimums(
            candidate as Parameters<typeof validateVoiceOfCustomerMinimums>[0],
          ),
      },
      env: {},
      verification: buildVerificationReport(),
    });

    expect(verdict.kind).toBe("committable");
  });
});
