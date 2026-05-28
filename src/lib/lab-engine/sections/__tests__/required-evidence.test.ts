import { describe, expect, it } from "vitest";

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
});
