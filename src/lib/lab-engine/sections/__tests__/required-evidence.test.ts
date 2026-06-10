import { describe, expect, it } from "vitest";

import { buyerICPFixtureArtifact } from "../../fixtures/buyer-icp-artifact";
import { competitorLandscapeFixtureArtifact } from "../../fixtures/competitor-landscape-artifact";
import { marketCategoryFixtureArtifact } from "../../fixtures/market-category-artifact";
import {
  checkRequiredEvidenceClasses,
  RequiredEvidenceMissingError,
} from "../required-evidence";
import {
  isNotProbedSentinel,
  NOT_PROBED_THIS_RUN_PHRASE,
} from "../sentinels";

describe("checkRequiredEvidenceClasses", (): void => {
  it("matches the not-probed sentinel as a substring", (): void => {
    expect(
      isNotProbedSentinel(
        `LinkedIn ad library was ${NOT_PROBED_THIS_RUN_PHRASE}; LinkedIn counts are structurally 0.`,
      ),
    ).toBe(true);
    expect(isNotProbedSentinel("LinkedIn returned no raw ad-library rows.")).toBe(
      false,
    );
  });

  it("passes when all configured evidence classes are present", (): void => {
    expect(
      checkRequiredEvidenceClasses({
        body: marketCategoryFixtureArtifact.body,
        requiredEvidenceClasses: ["marketCategory_name"],
        sectionId: "positioningMarketCategory",
      }),
    ).toBeNull();
    expect(
      checkRequiredEvidenceClasses({
        body: competitorLandscapeFixtureArtifact.body,
        requiredEvidenceClasses: ["competitor", "adEvidence_or_gap"],
        sectionId: "positioningCompetitorLandscape",
      }),
    ).toBeNull();
  });

  it("accepts ad evidence gaps as the honest alternative to creative evidence", (): void => {
    const body = structuredClone(competitorLandscapeFixtureArtifact.body);
    body.adEvidence.advertiserGroups = [
      {
        ...body.adEvidence.advertiserGroups[0],
        displayableTotal: 0,
        returnedCreativeCount: 0,
        creatives: [],
        rawSourceSamples: [],
        dataGaps: [{ platform: "google", reason: "No active creatives returned." }],
        sourceErrors: [],
      },
    ];

    expect(
      checkRequiredEvidenceClasses({
        body,
        requiredEvidenceClasses: ["adEvidence_or_gap"],
        sectionId: "positioningCompetitorLandscape",
      }),
    ).toBeNull();
  });

  it("returns the first missing class and exposes structured error metadata", (): void => {
    const body = structuredClone(competitorLandscapeFixtureArtifact.body);
    body.adEvidence.advertiserGroups = [];

    const missingClass = checkRequiredEvidenceClasses({
      body,
      requiredEvidenceClasses: ["competitor", "adEvidence_or_gap"],
      sectionId: "positioningCompetitorLandscape",
    });

    expect(missingClass).toBe("adEvidence_or_gap");
    expect(
      new RequiredEvidenceMissingError({
        missingClass: "adEvidence_or_gap",
        sectionId: "positioningCompetitorLandscape",
        unsupportedCount: 2,
        verifiedCount: 8,
      }),
    ).toMatchObject({
      name: "RequiredEvidenceMissingError",
      missingClass: "adEvidence_or_gap",
      sectionId: "positioningCompetitorLandscape",
      unsupportedCount: 2,
      verifiedCount: 8,
    });
  });

  it("rejects BuyerICP persona rows when every persona name is only a role or segment label", (): void => {
    const body = structuredClone(buyerICPFixtureArtifact.body);
    body.personaReality.personas = body.personaReality.personas.map((persona) => ({
      ...persona,
      name: persona.role === "economic-buyer" ? "Economic buyer" : "Finance leaders",
    }));

    expect(
      checkRequiredEvidenceClasses({
        body,
        requiredEvidenceClasses: ["icp_persona"],
        sectionId: "positioningBuyerICP",
      }),
    ).toBe("icp_persona");
  });

  it("accepts explicit BuyerICP named-persona gaps as the honest alternative to persona proof", (): void => {
    const body = {
      ...buyerICPFixtureArtifact.body,
      personaReality: {
        ...buyerICPFixtureArtifact.body.personaReality,
        personas: [],
      },
      evidenceGap: true,
      evidenceGapReport: {
        reason: "insufficient_named_buyer_personas",
        summary: "Found 0 named buyer personas; required 5.",
        foundNamedPersonaCount: 0,
        requiredNamedPersonaCount: 5,
        rejectedPersonaLabels: ["Finance leaders"],
        sourcingPlan: ["Recover named buyer identities from primary discovery."],
      },
    };

    expect(
      checkRequiredEvidenceClasses({
        body,
        requiredEvidenceClasses: ["icp_persona"],
        sectionId: "positioningBuyerICP",
      }),
    ).toBeNull();
  });

  it("rejects generic BuyerICP evidence filler when there is no explicit nested gap", (): void => {
    const body = structuredClone(buyerICPFixtureArtifact.body);
    body.personaReality.personas = body.personaReality.personas.map((persona) => ({
      ...persona,
      evidence: "evidence gap",
      sourceUrl: "",
    }));
    body.buyingContext.triggers = body.buyingContext.triggers.map((trigger) => ({
      ...trigger,
      evidence: "evidence gap",
      sourceUrl: undefined,
    }));

    expect(
      checkRequiredEvidenceClasses({
        body,
        requiredEvidenceClasses: ["icp_quote_or_gap"],
        sectionId: "positioningBuyerICP",
      }),
    ).toBe("icp_quote_or_gap");
  });

  it("accepts explicit nested BuyerICP gaps as the honest alternative to named evidence", (): void => {
    const body = {
      ...buyerICPFixtureArtifact.body,
      personaReality: {
        ...buyerICPFixtureArtifact.body.personaReality,
        personas: [],
      },
      buyingContext: {
        ...buyerICPFixtureArtifact.body.buyingContext,
        triggers: [],
      },
      clusters: {
        ...buyerICPFixtureArtifact.body.clusters,
        dataGaps: ["No named buyer identity found in public evidence."],
      },
    };

    expect(
      checkRequiredEvidenceClasses({
        body,
        requiredEvidenceClasses: ["icp_quote_or_gap"],
        sectionId: "positioningBuyerICP",
      }),
    ).toBeNull();
  });

  describe("LAB_AD_EVIDENCE_STRICT gate teeth", (): void => {
    // A group with no displayable evidence and ONLY the linkedin not-probed
    // sentinel + raw source samples: default permits it, strict must reject.
    function rubberStampGroup() {
      const base = competitorLandscapeFixtureArtifact.body.adEvidence
        .advertiserGroups[0];
      return {
        ...base,
        displayableTotal: 0,
        returnedCreativeCount: 0,
        creatives: [],
        rawSourceSamples: [
          {
            id: "raw_meta_gong_0",
            platform: "meta" as const,
            advertiserName: "Gong",
            headline: "Win more deals",
            body: null,
            imageUrl: null,
            videoUrl: null,
            detailsUrl: null,
            sourceUrl: "https://www.facebook.com/ads/library/?id=1",
            format: null,
            dataGap: null,
            source: null,
            transcript: null,
            cta: null,
          },
        ],
        dataGaps: [
          {
            platform: "linkedin" as const,
            reason: `LinkedIn ad library was ${NOT_PROBED_THIS_RUN_PHRASE}; LinkedIn counts are structurally 0 and are a not-probed sentinel, not an empty ad-library result.`,
          },
        ],
        sourceErrors: [],
      };
    }

    it("default mode keeps the permissive behavior (rawSourceSamples + sentinel pass)", (): void => {
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [rubberStampGroup()];

      expect(
        checkRequiredEvidenceClasses({
          body,
          env: {},
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });

    it("strict mode rejects a group with only rawSourceSamples and the not-probed sentinel", (): void => {
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [rubberStampGroup()];

      expect(
        checkRequiredEvidenceClasses({
          body,
          env: { LAB_AD_EVIDENCE_STRICT: "true" },
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBe("adEvidence_or_gap");
    });

    it("strict mode passes a group with a genuine probe-attempt sourceError", (): void => {
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [
        {
          ...rubberStampGroup(),
          sourceErrors: [
            { platform: "google" as const, message: "rate limited" },
          ],
        },
      ];

      expect(
        checkRequiredEvidenceClasses({
          body,
          env: { LAB_AD_EVIDENCE_STRICT: "true" },
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });

    it("strict mode passes a group with a genuine empty-result dataGap", (): void => {
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      const group = rubberStampGroup();
      body.adEvidence.advertiserGroups = [
        {
          ...group,
          dataGaps: [
            ...group.dataGaps,
            {
              platform: "google" as const,
              reason: "google returned no raw ad-library rows for this advertiser.",
            },
          ],
        },
      ];

      expect(
        checkRequiredEvidenceClasses({
          body,
          env: { LAB_AD_EVIDENCE_STRICT: "true" },
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });

    it("strict mode passes a group with real displayable creatives", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: competitorLandscapeFixtureArtifact.body,
          env: { LAB_AD_EVIDENCE_STRICT: "true" },
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });
  });

  describe("voc_quote_or_gap", (): void => {
    const emptyVocBody = {
      decisionCriteria: { criteria: [], prose: "evidence gap" },
      objections: { items: [], prose: "evidence gap" },
      painLanguage: { prose: "evidence gap", quotes: [] },
      successLanguage: { prose: "evidence gap", quotes: [] },
      switchingStories: { prose: "evidence gap", stories: [] },
    };

    it("fails a body with no quotes and no gap signal", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: emptyVocBody,
          requiredEvidenceClasses: ["voc_quote_or_gap"],
          sectionId: "positioningVoiceOfCustomer",
        }),
      ).toBe("voc_quote_or_gap");
    });

    it("accepts a per-block gap as the honest alternative to quotes", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyVocBody,
            objections: {
              ...emptyVocBody.objections,
              blockGap: {
                summary: "No independent objection language surfaced.",
                foundCount: 0,
                requiredCount: 5,
                sourcingPlan: ["Mine competitor G2 comparison categories."],
              },
            },
          },
          requiredEvidenceClasses: ["voc_quote_or_gap"],
          sectionId: "positioningVoiceOfCustomer",
        }),
      ).toBeNull();
    });

    it("accepts a verbatim pain quote without any gap", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyVocBody,
            painLanguage: {
              prose: "pain",
              quotes: [
                {
                  verbatimText: "the renewal doubled overnight",
                  source: "g2",
                  sourceUrl: "https://g2.com/x",
                  painTheme: "pricing",
                  painIntensity: "high",
                },
              ],
            },
          },
          requiredEvidenceClasses: ["voc_quote_or_gap"],
          sectionId: "positioningVoiceOfCustomer",
        }),
      ).toBeNull();
    });
  });
});
