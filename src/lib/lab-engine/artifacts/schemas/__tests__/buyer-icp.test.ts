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

  it("accepts exactly 3 named personas (floor 3)", (): void => {
    expect(validateBuyerICPMinimums(withPersonaCount(3))).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("rejects 2 personas without a gap report", (): void => {
    const result = validateBuyerICPMinimums(withPersonaCount(2));

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.personaReality.personas: have 2, need >=3.",
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

  it("continues rejecting missing awareness levels", (): void => {
    const artifact: BuyerICPArtifact = {
      ...buyerICPFixtureArtifact,
      body: {
        ...buyerICPFixtureArtifact.body,
        awarenessDistribution: {
          ...buyerICPFixtureArtifact.body.awarenessDistribution,
          levels: buyerICPFixtureArtifact.body.awarenessDistribution.levels.filter(
            (level) => level.level !== "most-aware",
          ),
        },
      },
    };

    const result = validateBuyerICPMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("missing levels most-aware");
  });
});
