import { describe, expect, it } from "vitest";

import { demandIntentFixtureArtifact } from "../../../fixtures/demand-intent-artifact";
import {
  checkDemandIntentKeywordProvenance,
  keywordSignalSchema,
  validateDemandIntentMinimums,
  type DemandIntentArtifact,
} from "../demand-intent";

function withKeywordVolume(
  monthlyVolume: string,
  keywordIndex = 0,
): DemandIntentArtifact {
  const keywords = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
    (keyword, index) =>
      index === keywordIndex ? { ...keyword, monthlyVolume } : keyword,
  );

  return {
    ...demandIntentFixtureArtifact,
    body: {
      ...demandIntentFixtureArtifact.body,
      keywordDemand: {
        ...demandIntentFixtureArtifact.body.keywordDemand,
        keywords,
      },
    },
  };
}

function withVenueAudience(audienceSize: string): DemandIntentArtifact {
  const venues = demandIntentFixtureArtifact.body.venueMap.venues.map(
    (venue) => ({ ...venue, audienceSize }),
  );

  return {
    ...demandIntentFixtureArtifact,
    body: {
      ...demandIntentFixtureArtifact.body,
      venueMap: { ...demandIntentFixtureArtifact.body.venueMap, venues },
    },
  };
}

describe("validateDemandIntentMinimums — monthlyVolume refusal guard", (): void => {
  it("accepts the fixture (real SpyFu-estimated volumes)", (): void => {
    expect(validateDemandIntentMinimums(demandIntentFixtureArtifact).ok).toBe(
      true,
    );
  });

  it("rejects 'not disclosed' in keywordDemand.keywords[].monthlyVolume", (): void => {
    const result = validateDemandIntentMinimums(
      withKeywordVolume("not disclosed"),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("monthlyVolume");
  });

  it("rejects a case-insensitive 'Not Disclosed' monthlyVolume", (): void => {
    expect(validateDemandIntentMinimums(withKeywordVolume("Not Disclosed")).ok).toBe(
      false,
    );
  });

  it("does NOT trip on 'not disclosed' in a non-signal field (venue audienceSize)", (): void => {
    // Scoping proof: the guard scans monthlyVolume only, so an undisclosed
    // audienceSize elsewhere is a content gap, not a validator failure.
    expect(validateDemandIntentMinimums(withVenueAudience("not disclosed")).ok).toBe(
      true,
    );
  });
});

describe("checkDemandIntentKeywordProvenance", (): void => {
  it("accepts SpyFu-estimated rows when keyword_volume succeeded", (): void => {
    // Fixture rows all carry "(SpyFu-estimated)" monthlyVolume.
    const result = checkDemandIntentKeywordProvenance({
      artifact: demandIntentFixtureArtifact,
      keywordVolumeSucceeded: true,
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects SpyFu-estimated rows when keyword_volume did NOT succeed", (): void => {
    const result = checkDemandIntentKeywordProvenance({
      artifact: demandIntentFixtureArtifact,
      keywordVolumeSucceeded: false,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // Errors name the offending row index.
    expect(result.errors.join(" ")).toContain(
      "body.keywordDemand.keywords[0]",
    );
  });

  it("accepts honest 'model estimate (SpyFu unavailable)' rows when keyword_volume failed", (): void => {
    const honest = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword) => ({
        ...keyword,
        monthlyVolume: "320 (model estimate (SpyFu unavailable))",
      }),
    );
    const artifact: DemandIntentArtifact = {
      ...demandIntentFixtureArtifact,
      body: {
        ...demandIntentFixtureArtifact.body,
        keywordDemand: {
          ...demandIntentFixtureArtifact.body.keywordDemand,
          keywords: honest,
        },
      },
    };

    const result = checkDemandIntentKeywordProvenance({
      artifact,
      keywordVolumeSucceeded: false,
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a SpyFu-claimed cpc when keyword_volume failed", (): void => {
    const keywords = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword, index) =>
        index === 0
          ? {
              ...keyword,
              monthlyVolume: "320 (model estimate (SpyFu unavailable))",
              cpc: "$4.10 (SpyFu-estimated)",
            }
          : {
              ...keyword,
              monthlyVolume: "320 (model estimate (SpyFu unavailable))",
            },
    );
    const artifact: DemandIntentArtifact = {
      ...demandIntentFixtureArtifact,
      body: {
        ...demandIntentFixtureArtifact.body,
        keywordDemand: {
          ...demandIntentFixtureArtifact.body.keywordDemand,
          keywords,
        },
      },
    };

    const result = checkDemandIntentKeywordProvenance({
      artifact,
      keywordVolumeSucceeded: false,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.keywordDemand.keywords[0]",
    );
  });
});

describe("keywordSignalSchema — optional cpc", (): void => {
  const baseRow = {
    keyword: "founder sales workflow",
    monthlyVolume: "320 (SpyFu-estimated)",
    intentType: "commercial" as const,
    top3RankingDomains: ["example.com"],
    sourceTitle: "Keyword Source",
    sourceUrl: "https://example.com/keyword",
    dateObserved: "2026-05-20",
  };

  it("accepts a row WITH cpc and numeric siblings", (): void => {
    expect(
      keywordSignalSchema.safeParse({
        ...baseRow,
        cpc: "$4.10 (SpyFu-estimated)",
        monthlyVolumeValue: 320,
        cpcValue: 4.1,
        difficulty: 22,
      }).success,
    ).toBe(true);
  });

  it("accepts a legacy row WITHOUT numeric siblings", (): void => {
    expect(keywordSignalSchema.safeParse(baseRow).success).toBe(true);
  });

  it.each([
    ["monthlyVolumeValue", -1],
    ["cpcValue", -0.01],
    ["difficulty", -1],
  ] as const)("rejects negative %s", (field, value): void => {
    expect(
      keywordSignalSchema.safeParse({
        ...baseRow,
        [field]: value,
      }).success,
    ).toBe(false);
  });
});
