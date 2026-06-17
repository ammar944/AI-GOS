import { afterEach, describe, expect, it, vi } from "vitest";

import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import type { RunSectionDeps, RunSectionInput } from "../run-section";
import {
  brandedKeywordPrepassRetryDelayMs,
  buildBrandedKeywordPrepass,
  buildBrandedKeywordTerms,
  buildCategoryDemandKeywordTerms,
  isUnfilledKeywordMeasurementMove,
} from "../run-section";
import { keywordVolumeKeywords } from "../run-section-keyword-results";

// Branded demand prepass (run 8081e646 cold-judge completeness fix): the
// subject's branded head terms are fetched deterministically before the
// demand-intent agent runs, so the branded demand floor is always measured.

const deps = {
  now: () => new Date("2026-06-11T12:00:00.000Z"),
} as unknown as RunSectionDeps;

const input = {
  runId: "run-branded-prepass",
  sectionId: "positioningDemandIntent",
} as unknown as RunSectionInput;

function keywordVolumeToolReturning(output: unknown): Record<string, unknown> {
  return {
    keyword_volume: {
      execute: async (): Promise<unknown> => output,
    },
  };
}

afterEach((): void => {
  vi.useRealTimers();
});

describe("buildBrandedKeywordTerms", () => {
  it("derives the four branded head terms from the company name", () => {
    expect(buildBrandedKeywordTerms("  Airtable ")).toEqual([
      "airtable",
      "airtable pricing",
      "airtable alternatives",
      "airtable reviews",
    ]);
  });

  it("returns no terms for a blank company name", () => {
    expect(buildBrandedKeywordTerms("   ")).toEqual([]);
  });
});

describe("buildCategoryDemandKeywordTerms", () => {
  it("seeds non-branded problem-aware terms from the stable category descriptor", () => {
    // Derived from company.category, NOT from model-generated orderedMoves text.
    expect(
      buildCategoryDemandKeywordTerms("AI-native GTM operations", "SaaSLaunch"),
    ).toEqual([
      "ai-native gtm operations",
      "ai-native gtm operations software",
      "best ai-native gtm operations",
      "ai-native gtm operations alternatives",
    ]);
  });

  it("returns no terms for a blank category", () => {
    expect(buildCategoryDemandKeywordTerms("   ", "SaaSLaunch")).toEqual([]);
  });

  it("drops a category term that collapses into the brand head terms", () => {
    // A descriptor that is literally the brand adds no non-branded signal.
    const terms = buildCategoryDemandKeywordTerms("Acme", "Acme");
    expect(terms).not.toContain("acme");
    expect(terms).not.toContain("acme alternatives");
    // The remaining shapes that are NOT branded head terms still seed.
    expect(terms).toContain("acme software");
    expect(terms).toContain("best acme");
  });
});

describe("isUnfilledKeywordMeasurementMove", () => {
  it("flags a top move that just re-instructs measuring keyword volume", () => {
    expect(
      isUnfilledKeywordMeasurementMove(
        "Measure keyword search volume for the category",
      ),
    ).toBe(true);
    expect(
      isUnfilledKeywordMeasurementMove(
        "Pull keyword demand and CPC for branded and non-branded terms",
      ),
    ).toBe(true);
  });

  it("does not flag a real strategic move that acts on demand", () => {
    expect(
      isUnfilledKeywordMeasurementMove(
        "Capture the high-intent 'alternatives' searchers with a comparison landing page",
      ),
    ).toBe(false);
    expect(
      isUnfilledKeywordMeasurementMove(
        "Reallocate budget toward the commercial-intent category terms",
      ),
    ).toBe(false);
    expect(isUnfilledKeywordMeasurementMove("")).toBe(false);
  });
});

describe("buildBrandedKeywordPrepass", () => {
  it("records a keyword_volume step and instructs the agent with the measured rows", async () => {
    const prepass = await buildBrandedKeywordPrepass({
      deps,
      input,
      researchInput: saaslaunchResearchInput,
      researchTools: keywordVolumeToolReturning({
        type: "result",
        source: "SpyFu",
        sourceUrl: "https://www.spyfu.com/",
        keywords: [
          {
            keyword: "saaslaunch",
            searchVolume: 2400,
            cpc: 3.1,
            difficulty: 22,
            sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=saaslaunch",
            display:
              '"saaslaunch" — 2,400/mo (SpyFu-estimated), CPC $3.10 (SpyFu-estimated), difficulty 22',
          },
          {
            keyword: "saaslaunch pricing",
            searchVolume: 320,
            cpc: null,
            difficulty: 14,
            sourceUrl:
              "https://www.spyfu.com/keyword/overview/us?query=saaslaunch%20pricing",
            display:
              '"saaslaunch pricing" — 320/mo (SpyFu-estimated), CPC n/a, difficulty 14',
          },
        ],
      }),
    });

    expect(prepass).toBeDefined();
    expect(prepass?.steps).toHaveLength(1);

    const step = prepass?.steps[0];
    expect(step?.toolCalls[0]?.toolName).toBe("keyword_volume");
    expect(step?.toolCalls[0]?.input).toEqual({
      keywords: [
        "saaslaunch",
        "saaslaunch pricing",
        "saaslaunch alternatives",
        "saaslaunch reviews",
        "ai-native gtm operations",
        "ai-native gtm operations software",
        "best ai-native gtm operations",
        "ai-native gtm operations alternatives",
      ],
    });

    // The recorded step feeds the keyword provenance validator directly.
    expect(keywordVolumeKeywords(prepass?.steps ?? [])).toEqual([
      "saaslaunch",
      "saaslaunch pricing",
    ]);

    expect(prepass?.candidateBlock).toContain("DEMAND PREPASS");
    expect(prepass?.candidateBlock).toContain('intentType "navigational"');
    expect(prepass?.candidateBlock).toContain("https://www.spyfu.com/");
    expect(prepass?.candidateBlock).toContain('dateObserved "2026-06-11"');
    expect(prepass?.candidateBlock).toContain("2,400/mo (SpyFu-estimated)");
    expect(prepass?.candidateBlock).toContain("branded-vs-non-branded");
  });

  it("seeds non-branded category terms into the SAME keyword_volume call as the branded terms", async () => {
    const captured: { keywords?: unknown } = {};
    const prepass = await buildBrandedKeywordPrepass({
      deps,
      input,
      researchInput: saaslaunchResearchInput,
      researchTools: {
        keyword_volume: {
          execute: async (toolInput: { keywords: string[] }): Promise<unknown> => {
            captured.keywords = toolInput.keywords;
            return {
              type: "result",
              source: "SpyFu",
              sourceUrl: "https://www.spyfu.com/",
              keywords: [
                {
                  keyword: "saaslaunch",
                  searchVolume: 2400,
                  cpc: 3.1,
                  difficulty: 22,
                  sourceUrl:
                    "https://www.spyfu.com/keyword/overview/us?query=saaslaunch",
                  display:
                    '"saaslaunch" — 2,400/mo (SpyFu-estimated), CPC $3.10 (SpyFu-estimated), difficulty 22',
                },
                {
                  keyword: "ai-native gtm operations software",
                  searchVolume: 880,
                  cpc: 6.4,
                  difficulty: 31,
                  sourceUrl:
                    "https://www.spyfu.com/keyword/overview/us?query=ai-native%20gtm%20operations%20software",
                  display:
                    '"ai-native gtm operations software" — 880/mo (SpyFu-estimated), CPC $6.40 (SpyFu-estimated), difficulty 31',
                },
              ],
            };
          },
        },
      },
    });

    // The single keyword_volume call carries BOTH branded head terms and the
    // category/problem-aware seeds derived from company.category.
    expect(captured.keywords).toEqual([
      "saaslaunch",
      "saaslaunch pricing",
      "saaslaunch alternatives",
      "saaslaunch reviews",
      "ai-native gtm operations",
      "ai-native gtm operations software",
      "best ai-native gtm operations",
      "ai-native gtm operations alternatives",
    ]);

    // Measured rows are split into branded vs non-branded sections, and the
    // non-branded category row is instructed away from "navigational".
    expect(prepass?.candidateBlock).toContain("BRANDED HEAD TERMS");
    expect(prepass?.candidateBlock).toContain(
      "NON-BRANDED CATEGORY / PROBLEM-AWARE TERMS",
    );
    expect(prepass?.candidateBlock).toContain(
      "ai-native gtm operations software",
    );
  });

  it("re-attempts once after a delay, then falls back to an honest gap instruction", async () => {
    vi.useFakeTimers();
    const execute = vi.fn(
      async (): Promise<unknown> => ({
        type: "gap",
        message: "SPYFU_API_KEY missing",
      }),
    );

    const prepassPromise = buildBrandedKeywordPrepass({
      deps,
      input,
      researchInput: saaslaunchResearchInput,
      researchTools: { keyword_volume: { execute } },
    });
    await vi.advanceTimersByTimeAsync(brandedKeywordPrepassRetryDelayMs);
    const prepass = await prepassPromise;

    // One delayed re-attempt, both honest gap steps recorded.
    expect(execute).toHaveBeenCalledTimes(2);
    expect(prepass?.steps).toHaveLength(2);
    expect(keywordVolumeKeywords(prepass?.steps ?? [])).toEqual([]);
    expect(prepass?.candidateBlock).toContain(
      "returned no data for the subject's branded head terms",
    );
    expect(prepass?.candidateBlock).toContain("never estimate volumes");
  });

  it("recovers measured rows on the delayed re-attempt after a transient failure", async () => {
    vi.useFakeTimers();
    const execute = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce({
        type: "gap",
        message: "SpyFu keyword volume rate-limited",
      })
      .mockResolvedValueOnce({
        type: "result",
        source: "SpyFu",
        sourceUrl: "https://www.spyfu.com/",
        keywords: [
          {
            keyword: "saaslaunch",
            searchVolume: 2400,
            cpc: 3.1,
            difficulty: 22,
            sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=saaslaunch",
            display:
              '"saaslaunch" — 2,400 searches/mo, CPC $3.10, difficulty 22 (SpyFu-estimated)',
          },
        ],
      });

    const prepassPromise = buildBrandedKeywordPrepass({
      deps,
      input,
      researchInput: saaslaunchResearchInput,
      researchTools: { keyword_volume: { execute } },
    });
    await vi.advanceTimersByTimeAsync(brandedKeywordPrepassRetryDelayMs);
    const prepass = await prepassPromise;

    // A single transient SpyFu failure no longer freezes the gap block: the
    // re-attempt's measured rows drive the candidate block.
    expect(execute).toHaveBeenCalledTimes(2);
    expect(prepass?.steps).toHaveLength(2);
    expect(keywordVolumeKeywords(prepass?.steps ?? [])).toEqual(["saaslaunch"]);
    expect(prepass?.candidateBlock).toContain("DEMAND PREPASS");
    expect(prepass?.candidateBlock).toContain("2,400 searches/mo");
  });

  it("degrades to the gap instruction with no steps when the tool is absent", async () => {
    const prepass = await buildBrandedKeywordPrepass({
      deps,
      input,
      researchInput: saaslaunchResearchInput,
      researchTools: {},
    });

    expect(prepass?.steps).toHaveLength(0);
    expect(prepass?.candidateBlock).toContain(
      "State the branded-volume and non-branded-demand gap honestly",
    );
  });

  it("returns undefined when the subject has no usable name", async () => {
    const prepass = await buildBrandedKeywordPrepass({
      deps,
      input,
      researchInput: {
        ...saaslaunchResearchInput,
        company: { ...saaslaunchResearchInput.company, name: "  " },
      },
      researchTools: {},
    });

    expect(prepass).toBeUndefined();
  });
});
