import { afterEach, describe, expect, it } from "vitest";

import { competitorLandscapeFixtureArtifact } from "../../fixtures/competitor-landscape-artifact";
import { marketCategoryFixtureArtifact } from "../../fixtures/market-category-artifact";
import {
  checkRequiredEvidenceClasses,
  RequiredEvidenceMissingError,
} from "../required-evidence";

describe("checkRequiredEvidenceClasses", (): void => {
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

  describe("LAB_AD_EVIDENCE_STRICT gate teeth", (): void => {
    const STRICT = "LAB_AD_EVIDENCE_STRICT";
    const previous = process.env[STRICT];

    afterEach((): void => {
      if (previous === undefined) {
        delete process.env[STRICT];
      } else {
        process.env[STRICT] = previous;
      }
    });

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
            reason:
              "LinkedIn ad library was not probed this run; LinkedIn counts are structurally 0 and are a not-probed sentinel, not an empty ad-library result.",
          },
        ],
        sourceErrors: [],
      };
    }

    it("default mode keeps the permissive behavior (rawSourceSamples + sentinel pass)", (): void => {
      delete process.env[STRICT];
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [rubberStampGroup()];

      expect(
        checkRequiredEvidenceClasses({
          body,
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });

    it("strict mode rejects a group with only rawSourceSamples and the not-probed sentinel", (): void => {
      process.env[STRICT] = "true";
      const body = structuredClone(competitorLandscapeFixtureArtifact.body);
      body.adEvidence.advertiserGroups = [rubberStampGroup()];

      expect(
        checkRequiredEvidenceClasses({
          body,
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBe("adEvidence_or_gap");
    });

    it("strict mode passes a group with a genuine probe-attempt sourceError", (): void => {
      process.env[STRICT] = "true";
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
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });

    it("strict mode passes a group with a genuine empty-result dataGap", (): void => {
      process.env[STRICT] = "true";
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
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });

    it("strict mode passes a group with real displayable creatives", (): void => {
      process.env[STRICT] = "true";

      expect(
        checkRequiredEvidenceClasses({
          body: competitorLandscapeFixtureArtifact.body,
          requiredEvidenceClasses: ["adEvidence_or_gap"],
          sectionId: "positioningCompetitorLandscape",
        }),
      ).toBeNull();
    });
  });
});
