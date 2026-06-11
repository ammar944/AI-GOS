import { afterEach, describe, expect, it, vi } from "vitest";

import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import type { RunSectionDeps, RunSectionInput } from "../run-section";
import {
  brandedKeywordPrepassRetryDelayMs,
  buildBrandedKeywordPrepass,
  buildBrandedKeywordTerms,
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
            display:
              '"saaslaunch" — 2,400/mo (SpyFu-estimated), CPC $3.10 (SpyFu-estimated), difficulty 22',
          },
          {
            keyword: "saaslaunch pricing",
            searchVolume: 320,
            cpc: null,
            difficulty: 14,
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
      ],
    });

    // The recorded step feeds the keyword provenance validator directly.
    expect(keywordVolumeKeywords(prepass?.steps ?? [])).toEqual([
      "saaslaunch",
      "saaslaunch pricing",
    ]);

    expect(prepass?.candidateBlock).toContain("BRANDED DEMAND PREPASS");
    expect(prepass?.candidateBlock).toContain('intentType "navigational"');
    expect(prepass?.candidateBlock).toContain("https://www.spyfu.com/");
    expect(prepass?.candidateBlock).toContain('dateObserved "2026-06-11"');
    expect(prepass?.candidateBlock).toContain("2,400/mo (SpyFu-estimated)");
    expect(prepass?.candidateBlock).toContain("branded-vs-non-branded");
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
    expect(prepass?.candidateBlock).toContain("never estimate branded volumes");
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
    expect(prepass?.candidateBlock).toContain("BRANDED DEMAND PREPASS");
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
      "State the branded-volume gap honestly",
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
