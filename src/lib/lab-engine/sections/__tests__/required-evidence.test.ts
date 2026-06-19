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

  it("rejects competitor rows that only carry names without a domain or source URL", (): void => {
    const body = structuredClone(competitorLandscapeFixtureArtifact.body);
    body.competitorSet.competitors = body.competitorSet.competitors.map(
      (competitor) => ({
        ...competitor,
        sourceUrl: "",
        url: "",
      }),
    );

    expect(
      checkRequiredEvidenceClasses({
        body,
        requiredEvidenceClasses: ["competitor"],
        sectionId: "positioningCompetitorLandscape",
      }),
    ).toBe("competitor");
  });

  it("accepts a competitor blockGap only when it carries found and required counts", (): void => {
    const baseBody = structuredClone(competitorLandscapeFixtureArtifact.body);
    baseBody.competitorSet.competitors = [];

    expect(
      checkRequiredEvidenceClasses({
        body: {
          ...baseBody,
          competitorSet: {
            ...baseBody.competitorSet,
            blockGap: {
              summary: "Competitor discovery returned no domain-resolvable rows.",
            },
          },
        },
        requiredEvidenceClasses: ["competitor"],
        sectionId: "positioningCompetitorLandscape",
      }),
    ).toBe("competitor");

    expect(
      checkRequiredEvidenceClasses({
        body: {
          ...baseBody,
          competitorSet: {
            ...baseBody.competitorSet,
            blockGap: {
              foundCount: 0,
              requiredCount: 3,
              sourcingPlan: ["Run competitor discovery against SERP results."],
              summary: "Competitor discovery returned no domain-resolvable rows.",
            },
          },
        },
        requiredEvidenceClasses: ["competitor"],
        sectionId: "positioningCompetitorLandscape",
      }),
    ).toBeNull();
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

  it("rejects BuyerICP named-persona gaps without numeric found and required counts", (): void => {
    const body = {
      ...buyerICPFixtureArtifact.body,
      personaReality: {
        ...buyerICPFixtureArtifact.body.personaReality,
        personas: [],
      },
      evidenceGap: true,
      evidenceGapReport: {
        reason: "insufficient_named_buyer_personas",
        summary: "No named buyer personas surfaced.",
      },
    };

    expect(
      checkRequiredEvidenceClasses({
        body,
        requiredEvidenceClasses: ["icp_persona"],
        sectionId: "positioningBuyerICP",
      }),
    ).toBe("icp_persona");
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

    function quarantineOnlyGroup() {
      const base = competitorLandscapeFixtureArtifact.body.adEvidence
        .advertiserGroups[0];
      return {
        ...base,
        displayableTotal: 1,
        returnedCreativeCount: 1,
        displayableCounts: { google: 0, meta: 1, linkedin: 0 },
        verifiedCount: 0,
        quarantinedCount: 1,
        identityConfidence: "low" as const,
        creatives: [
          {
            ...base.creatives[0],
            verified: false,
            identityBasis: "name_only",
          },
        ],
        rawSourceSamples: [],
        dataGaps: [],
        sourceErrors: [],
      };
    }

    function verifiedGroup() {
      const group = quarantineOnlyGroup();
      return {
        ...group,
        verifiedCount: 1,
        quarantinedCount: 0,
        identityConfidence: "verified" as const,
        creatives: [
          {
            ...group.creatives[0],
            verified: true,
            identityBasis: "domain",
          },
        ],
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

    it("strict mode rejects quarantine-only displayable creatives as evidence", (): void => {
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [quarantineOnlyGroup()];

      expect(
        checkRequiredEvidenceClasses({
          body,
          env: { LAB_AD_EVIDENCE_STRICT: "true" },
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBe("adEvidence_or_gap");
    });

    it("strict mode accepts a quarantine-only downgrade only as an explicit gap", (): void => {
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [
        {
          ...quarantineOnlyGroup(),
          dataGaps: [
            {
              reason:
                "Identity-unverified ad signals only: verifiedCount=0; quarantinedCount=1.",
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

    it("strict mode passes a group with verified creatives", (): void => {
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [verifiedGroup()];

      expect(
        checkRequiredEvidenceClasses({
          body,
          env: { LAB_AD_EVIDENCE_STRICT: "true" },
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });

    it("strict mode rejects legacy creatives with undefined verification metadata", (): void => {
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [
        {
          ...quarantineOnlyGroup(),
          verifiedCount: undefined,
          quarantinedCount: undefined,
          identityConfidence: undefined,
          creatives: [
            {
              ...quarantineOnlyGroup().creatives[0],
              verified: undefined,
              identityBasis: undefined,
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
      ).toBe("adEvidence_or_gap");
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

    it("rejects a presence-only per-block gap without found and required counts", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyVocBody,
            objections: {
              ...emptyVocBody.objections,
              blockGap: {
                summary: "No independent objection language surfaced.",
              },
            },
          },
          requiredEvidenceClasses: ["voc_quote_or_gap"],
          sectionId: "positioningVoiceOfCustomer",
        }),
      ).toBe("voc_quote_or_gap");
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

    it("rejects quote text without a real HTTP source URL", (): void => {
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
                  sourceUrl: "",
                  painTheme: "pricing",
                  painIntensity: "high",
                },
              ],
            },
          },
          requiredEvidenceClasses: ["voc_quote_or_gap"],
          sectionId: "positioningVoiceOfCustomer",
        }),
      ).toBe("voc_quote_or_gap");
    });

    it("deduplicates identical VoC text and source pairs before accepting source-backed quote evidence", (): void => {
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
                  sourceUrl: "https://g2.com/products/acme/reviews/1",
                  painTheme: "pricing",
                  painIntensity: "high",
                },
                {
                  verbatimText: "The renewal doubled overnight",
                  source: "g2",
                  sourceUrl: "https://g2.com/products/acme/reviews/1",
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

  describe("demand_signal_or_gap", (): void => {
    const emptyDemandBody = {
      intentSignals: { items: [], prose: "evidence gap" },
      keywordDemand: { keywords: [], prose: "evidence gap" },
      questionMining: { prose: "evidence gap", questions: [] },
    };
    const demandBlockGap = {
      foundCount: 0,
      requiredCount: 10,
      sourcingPlan: ["Mine competitor community threads."],
      summary: "No verbatim buyer questions surfaced on public surfaces.",
    };

    it("fails a body with no signals and no gap signal", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: emptyDemandBody,
          requiredEvidenceClasses: ["demand_signal_or_gap"],
          sectionId: "positioningDemandIntent",
        }),
      ).toBe("demand_signal_or_gap");
    });

    it("rejects keyword text without a real HTTP source URL", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyDemandBody,
            keywordDemand: {
              ...emptyDemandBody.keywordDemand,
              keywords: [
                {
                  cpc: "data gap",
                  keyword: "sales intelligence software",
                  monthlyVolume: "data gap",
                  sourceTitle: "Keyword source",
                  sourceUrl: "",
                },
              ],
            },
          },
          requiredEvidenceClasses: ["demand_signal_or_gap"],
          sectionId: "positioningDemandIntent",
        }),
      ).toBe("demand_signal_or_gap");
    });

    it("rejects presence-only demand blockGaps without numeric accounting", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyDemandBody,
            questionMining: {
              ...emptyDemandBody.questionMining,
              blockGap: {
                summary: "No verbatim buyer questions surfaced.",
              },
            },
          },
          requiredEvidenceClasses: ["demand_signal_or_gap"],
          sectionId: "positioningDemandIntent",
        }),
      ).toBe("demand_signal_or_gap");
    });

    it("accepts a questionMining blockGap as the honest alternative to invented questions", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyDemandBody,
            questionMining: {
              ...emptyDemandBody.questionMining,
              blockGap: demandBlockGap,
            },
          },
          requiredEvidenceClasses: ["demand_signal_or_gap"],
          sectionId: "positioningDemandIntent",
        }),
      ).toBeNull();
    });

    it("accepts an intentSignals blockGap as the honest alternative to invented signals", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyDemandBody,
            intentSignals: {
              ...emptyDemandBody.intentSignals,
              blockGap: { ...demandBlockGap, requiredCount: 5 },
            },
          },
          requiredEvidenceClasses: ["demand_signal_or_gap"],
          sectionId: "positioningDemandIntent",
        }),
      ).toBeNull();
    });
  });

  describe("offer_axis (Fix 4: blockGap parity)", (): void => {
    const emptyOfferBody = {
      offerMarketFit: { prose: "evidence gap", proofPoints: [] },
      funnelDiagnosis: { prose: "evidence gap", breaks: [] },
      channelTruth: { prose: "evidence gap", channels: [] },
    };
    const offerBlockGap = {
      foundCount: 0,
      requiredCount: 3,
      sourcingPlan: ["Re-run acquisition for offerMarketFit."],
      summary: "Only 0 of the required 3 proof points could be sourced.",
    };

    it("fails an all-empty offer body with no axis and no gap signal", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: emptyOfferBody,
          requiredEvidenceClasses: ["offer_axis"],
          sectionId: "positioningOfferDiagnostic",
        }),
      ).toBe("offer_axis");
    });

    it("rejects offer rows without real HTTP source URLs", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyOfferBody,
            offerMarketFit: {
              ...emptyOfferBody.offerMarketFit,
              proofPoints: [
                {
                  metric: "activation lift",
                  sourceUrl: "",
                },
              ],
            },
          },
          requiredEvidenceClasses: ["offer_axis"],
          sectionId: "positioningOfferDiagnostic",
        }),
      ).toBe("offer_axis");
    });

    it("rejects presence-only offer blockGaps without numeric accounting", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyOfferBody,
            offerMarketFit: {
              ...emptyOfferBody.offerMarketFit,
              blockGap: {
                summary: "No proof points could be sourced.",
              },
            },
          },
          requiredEvidenceClasses: ["offer_axis"],
          sectionId: "positioningOfferDiagnostic",
        }),
      ).toBe("offer_axis");
    });

    it("accepts an offerMarketFit blockGap as the honest alternative (degraded commits, does not throw RequiredEvidenceMissing)", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyOfferBody,
            offerMarketFit: {
              ...emptyOfferBody.offerMarketFit,
              blockGap: offerBlockGap,
            },
          },
          requiredEvidenceClasses: ["offer_axis"],
          sectionId: "positioningOfferDiagnostic",
        }),
      ).toBeNull();
    });

    it("accepts a channelTruth blockGap as the honest alternative", (): void => {
      expect(
        checkRequiredEvidenceClasses({
          body: {
            ...emptyOfferBody,
            channelTruth: {
              ...emptyOfferBody.channelTruth,
              blockGap: { ...offerBlockGap, requiredCount: 3 },
            },
          },
          requiredEvidenceClasses: ["offer_axis"],
          sectionId: "positioningOfferDiagnostic",
        }),
      ).toBeNull();
    });
  });
});
