import { describe, expect, it } from "vitest";

import type { ResearchInput } from "@/lib/lab-engine/artifacts/artifact-envelope";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import { buildCompetitorSeedHints } from "../build-prompts";

describe("buildCompetitorSeedHints", (): void => {
  it("maps populated competitorSeeds even when competitorAds is empty", (): void => {
    const researchInput: ResearchInput = {
      ...saaslaunchResearchInput,
      competitorAds: [],
      competitorSeeds: [
        { name: "Gong", domain: "gong.io" },
        { name: "Chorus" },
      ],
    };

    const hints = buildCompetitorSeedHints(researchInput);

    expect(hints).toHaveLength(2);
    expect(hints.map((hint) => hint.name)).toEqual(["Gong", "Chorus"]);
    expect(hints[0]?.landingUrl).toBe("https://gong.io");
    expect(hints[0]?.sourceUrl).toBe("https://gong.io");
    expect(hints[1]?.landingUrl).toBeNull();
    expect(hints[1]?.sourceUrl).toBeNull();
  });

  it("returns an empty array when competitorSeeds is absent", (): void => {
    const researchInput: ResearchInput = {
      ...saaslaunchResearchInput,
      competitorAds: [],
      competitorSeeds: undefined,
    };

    expect(buildCompetitorSeedHints(researchInput)).toEqual([]);
  });
});
