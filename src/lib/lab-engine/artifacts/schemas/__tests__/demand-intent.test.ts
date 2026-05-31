import { describe, expect, it } from "vitest";

import { demandIntentFixtureArtifact } from "../../../fixtures/demand-intent-artifact";
import {
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
