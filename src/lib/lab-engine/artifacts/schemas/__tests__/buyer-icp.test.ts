import { describe, expect, it } from "vitest";

import { buyerICPFixtureArtifact } from "../../../fixtures/buyer-icp-artifact";
import {
  validateBuyerICPMinimums,
  type BuyerICPArtifact,
} from "../buyer-icp";

function replacePersona(
  index: number,
  patch: Partial<BuyerICPArtifact["body"]["personaReality"]["personas"][number]>,
): BuyerICPArtifact {
  const personas = buyerICPFixtureArtifact.body.personaReality.personas.map(
    (persona, personaIndex) =>
      personaIndex === index ? { ...persona, ...patch } : persona,
  );

  return {
    ...buyerICPFixtureArtifact,
    body: {
      ...buyerICPFixtureArtifact.body,
      personaReality: {
        ...buyerICPFixtureArtifact.body.personaReality,
        personas,
      },
    },
  };
}

function withPersonaCount(count: number): BuyerICPArtifact {
  return {
    ...buyerICPFixtureArtifact,
    body: {
      ...buyerICPFixtureArtifact.body,
      personaReality: {
        ...buyerICPFixtureArtifact.body.personaReality,
        personas: buyerICPFixtureArtifact.body.personaReality.personas.slice(
          0,
          count,
        ),
      },
    },
  };
}

describe("validateBuyerICPMinimums", (): void => {
  it("accepts the fixture", (): void => {
    expect(validateBuyerICPMinimums(buyerICPFixtureArtifact)).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("accepts exactly 3 named personas (above the floor)", (): void => {
    expect(validateBuyerICPMinimums(withPersonaCount(3))).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("accepts a single grounded persona (floor 1, quality-aware)", (): void => {
    // Floor relaxed from 3 -> 1 grounded: one real promoted champion clears it.
    expect(validateBuyerICPMinimums(withPersonaCount(1))).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("rejects ZERO grounded personas without a gap report", (): void => {
    const result = validateBuyerICPMinimums(withPersonaCount(0));

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.personaReality.personas: have 0 grounded, need >=1.",
    );
  });

  it("accepts 2 personas with the persona evidence-gap report", (): void => {
    const base = withPersonaCount(2);
    const artifact: BuyerICPArtifact = {
      ...base,
      body: {
        ...base.body,
        evidenceGap: true,
        evidenceGapReport: {
          reason: "insufficient_named_buyer_personas",
          summary: "Found 2 named buyer personas; required 3.",
          foundNamedPersonaCount: 2,
          requiredNamedPersonaCount: 3,
          rejectedPersonaLabels: [],
          sourcingPlan: ["Recover one more named buyer identity."],
        },
      },
    };

    expect(validateBuyerICPMinimums(artifact)).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("accepts a persona evidence-gap report carrying an acquisition ledger and sufficiency summary", (): void => {
    const base = withPersonaCount(2);
    const artifact: BuyerICPArtifact = {
      ...base,
      body: {
        ...base.body,
        evidenceGap: true,
        evidenceGapReport: {
          reason: "insufficient_named_buyer_personas",
          summary: "Found 2 named buyer personas; required 3.",
          foundNamedPersonaCount: 2,
          requiredNamedPersonaCount: 3,
          rejectedPersonaLabels: ["Finance leaders"],
          acquisitionLedger: [
            {
              sourceUrl: "https://example.com/team",
              domain: "example.com",
              query: "RevOps leaders mid-market SaaS",
              source: "Perplexity sonar-pro",
              candidateLabel: "Dana Ruiz, VP RevOps",
              promotionStatus: "promoted",
              observedAt: "2026-06-16T00:00:00.000Z",
            },
            {
              sourceUrl: "https://example.org/directory",
              domain: "example.org",
              query: "finance buyer persona SaaS",
              source: "web_search",
              candidateLabel: "Finance leaders",
              promotionStatus: "rejected",
              rejectionReason: "not_named_individual",
              observedAt: "2026-06-16T00:00:00.000Z",
            },
          ],
          sufficiency: {
            tier: "insufficient",
            rationale: "Only 2 of 3 named buyers cleared the evidence bar.",
            candidatesFound: 2,
            promoted: 1,
            rejected: 1,
          },
          sourcingPlan: ["Recover one more named buyer identity."],
        },
      },
    };

    expect(validateBuyerICPMinimums(artifact)).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("accepts a persona carrying the derived vendorSourced label", (): void => {
    const artifact = replacePersona(0, { vendorSourced: true });

    expect(validateBuyerICPMinimums(artifact)).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("rejects persona names that are role or segment labels", (): void => {
    const artifact = replacePersona(0, { name: "Economic buyer" });

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.personaReality.personas[0].name",
    );
  });

  it("rejects plural segment-style persona names", (): void => {
    const artifact = replacePersona(4, { name: "Finance leaders" });

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.personaReality.personas[4].name",
    );
    expect(result.errors.join(" ")).toContain("generic role/segment/company label");
  });

  it("accepts an explicit named-persona evidence gap without placeholder persona rows", (): void => {
    const artifact: BuyerICPArtifact = {
      ...buyerICPFixtureArtifact,
      body: {
        ...buyerICPFixtureArtifact.body,
        personaReality: {
          ...buyerICPFixtureArtifact.body.personaReality,
          prose:
            "Evidence gap: public research did not clear the named BuyerICP persona bar.",
          personas: [],
        },
        evidenceGap: true,
        evidenceGapReport: {
          reason: "insufficient_named_buyer_personas",
          summary:
            "Found 0 named buyer personas; required 5. Generic labels were dropped.",
          foundNamedPersonaCount: 0,
          requiredNamedPersonaCount: 5,
          rejectedPersonaLabels: ["Finance leaders"],
          sourcingPlan: ["Run primary discovery or recover public named buyer proof."],
        },
      },
    };

    expect(validateBuyerICPMinimums(artifact)).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("keeps rejecting generic persona rows even on an evidence-gap artifact", (): void => {
    const artifact: BuyerICPArtifact = {
      ...replacePersona(0, { name: "Economic buyer" }),
      body: {
        ...replacePersona(0, { name: "Economic buyer" }).body,
        evidenceGap: true,
        evidenceGapReport: {
          reason: "insufficient_named_buyer_personas",
          summary:
            "Found 4 named buyer personas; required 5. Generic labels were dropped.",
          foundNamedPersonaCount: 4,
          requiredNamedPersonaCount: 5,
          rejectedPersonaLabels: ["Economic buyer"],
          sourcingPlan: ["Recover one more named buyer identity."],
        },
      },
    };

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.personaReality.personas[0].name",
    );
  });

  it("rejects persona names copied from role, title, or company fields", (): void => {
    const titleArtifact = replacePersona(2, { name: "Revenue Operator" });
    const companyArtifact = replacePersona(3, { name: "Fixture SaaS 4" });

    expect(validateBuyerICPMinimums(titleArtifact).ok).toBe(false);
    expect(validateBuyerICPMinimums(companyArtifact).ok).toBe(false);
  });

  it("rejects invalid row-level source URLs across BuyerICP sections", (): void => {
    const artifact: BuyerICPArtifact = {
      ...buyerICPFixtureArtifact,
      body: {
        ...buyerICPFixtureArtifact.body,
        icpExistenceCheck: {
          ...buyerICPFixtureArtifact.body.icpExistenceCheck,
          firmographicCuts: buyerICPFixtureArtifact.body.icpExistenceCheck.firmographicCuts.map(
            (cut, index) =>
              index === 0 ? { ...cut, sourceUrl: "not-a-url" } : cut,
          ),
        },
        personaReality: {
          ...buyerICPFixtureArtifact.body.personaReality,
          personas: buyerICPFixtureArtifact.body.personaReality.personas.map(
            (persona, index) =>
              index === 0 ? { ...persona, sourceUrl: "notaurl" } : persona,
          ),
        },
        buyingContext: {
          ...buyerICPFixtureArtifact.body.buyingContext,
          triggers: buyerICPFixtureArtifact.body.buyingContext.triggers.map(
            (trigger, index) =>
              index === 0 ? { ...trigger, sourceUrl: "ftp://bad.example.com" } : trigger,
          ),
        },
        clusters: {
          ...buyerICPFixtureArtifact.body.clusters,
          venues: buyerICPFixtureArtifact.body.clusters.venues.map(
            (venue, index) =>
              index === 0 ? { ...venue, sourceUrl: "bad-url" } : venue,
          ),
        },
      },
    };

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.icpExistenceCheck.firmographicCuts[0].sourceUrl",
    );
    expect(result.errors.join(" ")).toContain(
      "body.personaReality.personas[0].sourceUrl",
    );
    expect(result.errors.join(" ")).toContain(
      "body.buyingContext.triggers[0].sourceUrl",
    );
    expect(result.errors.join(" ")).toContain("body.clusters.venues[0].sourceUrl");
  });

  it("rejects numeric-looking awareness shares without provenance basis", (): void => {
    const artifact: BuyerICPArtifact = {
      ...buyerICPFixtureArtifact,
      body: {
        ...buyerICPFixtureArtifact.body,
        awarenessDistribution: {
          ...buyerICPFixtureArtifact.body.awarenessDistribution,
          levels: buyerICPFixtureArtifact.body.awarenessDistribution.levels.map(
            (level, index) =>
              index === 0
                ? {
                    ...level,
                    share: "42%",
                    evidence: "Directional awareness guess.",
                    sampleQuery: undefined,
                  }
                : level,
          ),
        },
      },
    };

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.awarenessDistribution.levels[0].share",
    );
  });

  it("rejects qualitative awareness shares without evidence or sample-query basis", (): void => {
    const artifact: BuyerICPArtifact = {
      ...buyerICPFixtureArtifact,
      body: {
        ...buyerICPFixtureArtifact.body,
        awarenessDistribution: {
          ...buyerICPFixtureArtifact.body.awarenessDistribution,
          levels: buyerICPFixtureArtifact.body.awarenessDistribution.levels.map(
            (level, index) =>
              index === 1
                ? {
                    ...level,
                    share: "medium",
                    evidence: "directional hunch",
                    sampleQuery: undefined,
                  }
                : level,
          ),
        },
      },
    };

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.awarenessDistribution.levels[1].share",
    );
  });

  it("continues rejecting duplicate awareness levels", (): void => {
    const levels = [...buyerICPFixtureArtifact.body.awarenessDistribution.levels];
    levels[0] = {
      ...levels[0],
      level: "problem-aware",
    };
    const artifact: BuyerICPArtifact = {
      ...buyerICPFixtureArtifact,
      body: {
        ...buyerICPFixtureArtifact.body,
        awarenessDistribution: {
          ...buyerICPFixtureArtifact.body.awarenessDistribution,
          levels,
        },
      },
    };

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate level problem-aware");
  });

  it("accepts partial awareness levels without forcing all five stages", (): void => {
    const artifact: BuyerICPArtifact = {
      ...buyerICPFixtureArtifact,
      body: {
        ...buyerICPFixtureArtifact.body,
        awarenessDistribution: {
          ...buyerICPFixtureArtifact.body.awarenessDistribution,
          dominantLevel: "problem-aware",
          levels: buyerICPFixtureArtifact.body.awarenessDistribution.levels.filter(
            (level) => level.level !== "most-aware",
          ),
        },
      },
    };

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("(Task 3) accepts an optional per-row evidenceTier on a persona (additive)", (): void => {
    const artifact = replacePersona(0, { evidenceTier: "directional_signal" });

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(
      validateBuyerICPMinimums(artifact) &&
        artifact.body.personaReality.personas[0]?.evidenceTier,
    ).toBe("directional_signal");
  });

  it("(Task 3) renders clusters acquisition_gap distinctly from persona strippedByVerifier", (): void => {
    // clusters: NO venue-discovery tool wired -> acquisitionGap. personaReality:
    // a verifier-downgraded row -> strippedByVerifier. The two coverage states
    // are distinct, additive, and both validate.
    const artifact: BuyerICPArtifact = {
      ...buyerICPFixtureArtifact,
      body: {
        ...buyerICPFixtureArtifact.body,
        clusters: {
          ...buyerICPFixtureArtifact.body.clusters,
          coverage: {
            byTier: {
              hard_evidence: 0,
              directional_signal: 0,
              strategic_inference: 0,
              operator_input: 0,
            },
            acquisitionGaps: [
              {
                whatWasSought: "buyer venue clusters",
                reason: "no_tool_wired",
                surfacesQueried: [],
                sourcingPlan: ["Wire a venue-discovery tool (PAA/Reddit)."],
              },
            ],
            strippedByVerifier: [],
            readiness: "gap",
          },
        },
        personaReality: {
          ...buyerICPFixtureArtifact.body.personaReality,
          coverage: {
            byTier: {
              hard_evidence: 0,
              directional_signal: 1,
              strategic_inference: 0,
              operator_input: 0,
            },
            acquisitionGaps: [],
            strippedByVerifier: [
              {
                summary: "Promoted champion Bill Cox at Ramp",
                originalTier: "hard_evidence",
                droppedReason: "unreachable: re-fetch redirected to interstitial",
                sourceUrl: "https://ramp.com/customers/wizehire",
              },
            ],
            readiness: "thin",
          },
        },
      },
    };

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    // The two states are distinguishable: clusters reports a void, persona a strip.
    expect(artifact.body.clusters.coverage?.acquisitionGaps).toHaveLength(1);
    expect(artifact.body.clusters.coverage?.strippedByVerifier).toHaveLength(0);
    expect(artifact.body.personaReality.coverage?.acquisitionGaps).toHaveLength(0);
    expect(
      artifact.body.personaReality.coverage?.strippedByVerifier,
    ).toHaveLength(1);
  });
});
