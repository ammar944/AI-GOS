import { afterEach, describe, expect, it, vi } from "vitest";

import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import type { RunSectionDeps, RunSectionInput } from "../run-section";
import {
  brandedKeywordPrepassRetryDelayMs,
  buildBrandedKeywordPrepass,
  buildBrandedKeywordTerms,
  buildCategoryDemandKeywordTerms,
  categoryDemandHeadTokens,
  isCommercialDemandKeyword,
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
  it("extracts clean commercial head terms from a parenthetical category descriptor", () => {
    // Ramp's prose category wraps the searchable heads in parentheses and joins
    // them with "&". The seed must surface the searchable commercial heads, not
    // the unsearchable whole-string wrap, and must drop the over-generic
    // umbrella head ("financial technology").
    const terms = buildCategoryDemandKeywordTerms(
      "Financial technology (corporate cards & spend management)",
      "Ramp",
    );
    expect(terms).toContain("spend management");
    expect(terms).toContain("spend management software");
    expect(terms).toContain("corporate cards");
    // No whole-string wrap and no over-generic umbrella head.
    for (const term of terms) {
      expect(term).not.toContain("financial technology");
      expect(term).not.toContain("(");
    }
  });

  it("emits the bare/software/alternatives commercial variants per clean head", () => {
    const terms = buildCategoryDemandKeywordTerms("Spend management", "Ramp");
    expect(terms).toEqual([
      "spend management",
      "spend management software",
      "spend management alternatives",
    ]);
  });

  it("returns no terms for a blank category", () => {
    expect(buildCategoryDemandKeywordTerms("   ", "SaaSLaunch")).toEqual([]);
  });

  it("drops a category head that collapses into the brand head terms", () => {
    // A descriptor whose only head is literally the brand adds no non-branded
    // signal — the "<brand> alternatives" variant collapses into the branded
    // head terms and is dropped; the bare brand head is dropped too.
    const terms = buildCategoryDemandKeywordTerms("Acme", "Acme");
    expect(terms).not.toContain("acme");
    expect(terms).not.toContain("acme alternatives");
    // The remaining commercial shape that is NOT a branded head term still seeds.
    expect(terms).toContain("acme software");
  });
});

describe("isCommercialDemandKeyword", () => {
  // The category head tokens for Ramp's commercial heads.
  const ramp = categoryDemandHeadTokens(
    "Financial technology (corporate cards & spend management)",
  );

  it("drops educational / definitional / government junk", () => {
    expect(isCommercialDemandKeyword("opportunity cost", ramp)).toBe(false);
    expect(isCommercialDemandKeyword("california secretary of state", ramp)).toBe(
      false,
    );
    expect(isCommercialDemandKeyword("mission statement examples", ramp)).toBe(
      false,
    );
  });

  it("keeps a row that matches a commercial-intent modifier", () => {
    expect(isCommercialDemandKeyword("spend management software", ramp)).toBe(
      true,
    );
  });

  it("keeps a row that shares a token with the category heads", () => {
    // "expense management" shares "management" with the "spend management" head.
    expect(isCommercialDemandKeyword("expense management", ramp)).toBe(true);
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

    // R-G: the reader-bound sourceTitle the model copies must be human-facing,
    // never the raw tool identifier "keyword_volume" (a forbidden reader term
    // that leaked into the keyword table Source column).
    expect(prepass?.candidateBlock).toContain(
      'sourceTitle "SpyFu monthly search volume"',
    );
    expect(prepass?.candidateBlock).not.toContain("keyword_volume");
    expect(prepass?.candidateBlock).not.toContain("keyword_discovery");
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

  // FIX-DEMAND: the branded keyword_volume call only measures the brand
  // defending itself + a few stable category descriptors — it never surfaces the
  // non-branded keywords competitors rank/bid on that the subject does not. That
  // gap set IS the non-branded measured demand a media buyer sizes feasibility
  // against; without invoking keyword_discovery the section reports "unknown"
  // non-branded demand. These tests pin the deterministic discovery invocation.
  const researchInputWithCompetitorSeeds = {
    ...saaslaunchResearchInput,
    company: {
      ...saaslaunchResearchInput.company,
      websiteUrl: "https://airtable.com",
      // Finance-aligned category so the discovery-relevance filter keeps the
      // commercial finance gap keywords this fixture returns ("corporate cards"
      // shares the "corporate cards" head; "expense management software" carries
      // the commercial modifier).
      category: "Corporate cards & spend management",
    },
    competitorSeeds: [
      { name: "Ramp", domain: "ramp.com", provenance: "user-supplied" as const },
      { name: "Brex", domain: "brex.com", provenance: "user-supplied" as const },
    ],
  };

  function brandedRowsVolumeOutput(): unknown {
    return {
      type: "result",
      source: "SpyFu",
      sourceUrl: "https://www.spyfu.com/",
      keywords: [
        {
          keyword: "airtable",
          searchVolume: 2400,
          cpc: 3.1,
          difficulty: 22,
          sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=airtable",
          display:
            '"airtable" — 2,400/mo (SpyFu-estimated), CPC $3.10 (SpyFu-estimated), difficulty 22',
        },
      ],
    };
  }

  function discoveryRowsOutput(): unknown {
    return {
      type: "result",
      source: "SpyFu",
      sourceUrl: "https://www.spyfu.com/",
      keywords: [
        {
          keyword: "expense management software",
          searchVolume: 5400,
          cpc: 22.1,
          difficulty: 41,
          sourceUrl:
            "https://www.spyfu.com/keyword/overview/us?query=expense%20management%20software",
          display:
            '"expense management software" — 5,400/mo (SpyFu-estimated), CPC $22.10 (SpyFu-estimated), difficulty 41',
        },
        {
          keyword: "corporate cards",
          searchVolume: 2900,
          cpc: 14.0,
          difficulty: 36,
          sourceUrl:
            "https://www.spyfu.com/keyword/overview/us?query=corporate%20cards",
          display:
            '"corporate cards" — 2,900/mo (SpyFu-estimated), CPC $14.00 (SpyFu-estimated), difficulty 36',
        },
      ],
    };
  }

  it("invokes keyword_discovery against the competitor seed domains and lands non-branded measured rows", async () => {
    const discoveryInputs: unknown[] = [];
    const prepass = await buildBrandedKeywordPrepass({
      deps,
      input,
      researchInput: researchInputWithCompetitorSeeds,
      researchTools: {
        keyword_volume: {
          execute: async (): Promise<unknown> => brandedRowsVolumeOutput(),
        },
        keyword_discovery: {
          execute: async (toolInput: unknown): Promise<unknown> => {
            discoveryInputs.push(toolInput);
            return discoveryRowsOutput();
          },
        },
      },
    });

    // keyword_discovery was invoked once, deterministically, with the subject
    // domain vs the resolved competitor seed domains and the volume floor.
    expect(discoveryInputs).toHaveLength(1);
    expect(discoveryInputs[0]).toEqual({
      domain: "airtable.com",
      competitorDomains: ["ramp.com", "brex.com"],
      minSearchVolume: 50,
    });

    // The recorded discovery step rides the steps list so the keyword
    // provenance validator (keywordVolumeKeywords) accepts the discovered rows.
    expect(keywordVolumeKeywords(prepass?.steps ?? [])).toEqual([
      "airtable",
      "expense management software",
      "corporate cards",
    ]);

    // The non-branded discovered gap keywords land in the candidate block with
    // their own SpyFu permalinks — the demand read a media buyer needs.
    expect(prepass?.candidateBlock).toContain(
      "NON-BRANDED COMPETITOR GAP KEYWORDS",
    );
    expect(prepass?.candidateBlock).toContain("expense management software");
    expect(prepass?.candidateBlock).toContain("corporate cards");
    expect(prepass?.candidateBlock).toContain(
      "https://www.spyfu.com/keyword/overview/us?query=expense%20management%20software",
    );
  });

  it("lands discovered non-branded rows even when the branded keyword_volume call is empty", async () => {
    vi.useFakeTimers();
    const prepassPromise = buildBrandedKeywordPrepass({
      deps,
      input,
      researchInput: researchInputWithCompetitorSeeds,
      researchTools: {
        keyword_volume: {
          execute: async (): Promise<unknown> => ({
            type: "gap",
            message: "SpyFu keyword volume rate-limited",
          }),
        },
        keyword_discovery: {
          execute: async (): Promise<unknown> => discoveryRowsOutput(),
        },
      },
    });
    await vi.advanceTimersByTimeAsync(brandedKeywordPrepassRetryDelayMs);
    const prepass = await prepassPromise;

    // Branded volume came back empty (after the retry), but discovery surfaced
    // real non-branded demand — the block must NOT collapse to the pure gap.
    expect(prepass?.candidateBlock).not.toContain(
      "State the branded-volume and non-branded-demand gap honestly",
    );
    expect(prepass?.candidateBlock).toContain(
      "NON-BRANDED COMPETITOR GAP KEYWORDS",
    );
    expect(prepass?.candidateBlock).toContain("expense management software");
    expect(keywordVolumeKeywords(prepass?.steps ?? [])).toEqual([
      "expense management software",
      "corporate cards",
    ]);
  });

  it("keeps the honest gap when no competitor seed domains are available", async () => {
    let discoveryCalled = false;
    const prepass = await buildBrandedKeywordPrepass({
      deps,
      input,
      // No competitorSeeds → keyword_discovery has no domains to compare against.
      researchInput: {
        ...saaslaunchResearchInput,
        company: {
          ...saaslaunchResearchInput.company,
          websiteUrl: "https://airtable.com",
        },
      },
      researchTools: {
        keyword_volume: {
          execute: async (): Promise<unknown> => brandedRowsVolumeOutput(),
        },
        keyword_discovery: {
          execute: async (): Promise<unknown> => {
            discoveryCalled = true;
            return discoveryRowsOutput();
          },
        },
      },
    });

    // Discovery is NOT invoked with zero usable competitor domains — no
    // self-comparison, no wasted paid lookup. The branded rows still ship.
    expect(discoveryCalled).toBe(false);
    expect(prepass?.candidateBlock).not.toContain(
      "NON-BRANDED COMPETITOR GAP KEYWORDS",
    );
    expect(prepass?.candidateBlock).toContain("airtable");
  });

  // R-A: the same deterministic keyword_volume prepass also serves the Market &
  // Category section, where the measured commercial demand sources
  // marketSize.signals + bottomUpTam.inputs (an honest, sourced TAM read instead
  // of the empty signals:[] + 4/4 evidence-gap the section shipped). The block
  // text branches on sectionId so the Market model is instructed to populate the
  // TAM, NOT the demand-intent keyword table.
  const marketInput = {
    runId: "run-market-prepass",
    sectionId: "positioningMarketCategory",
  } as unknown as RunSectionInput;

  it("instructs the Market model to source marketSize.signals + bottomUpTam.inputs from the measured commercial rows", async () => {
    const prepass = await buildBrandedKeywordPrepass({
      deps,
      input: marketInput,
      researchInput: saaslaunchResearchInput,
      researchTools: keywordVolumeToolReturning({
        type: "result",
        source: "SpyFu",
        sourceUrl: "https://www.spyfu.com/",
        keywords: [
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
      }),
    });

    expect(prepass).toBeDefined();
    // The Market block is TAM-flavored, not the demand keyword table.
    expect(prepass?.candidateBlock).toContain("marketSize.signals");
    expect(prepass?.candidateBlock).toContain("bottomUpTam.inputs");
    // The four TAM input types are addressed: keyword-volume + commercial-intent
    // share sourced, conversion-rate an honest gap, acv from operator brief.
    expect(prepass?.candidateBlock).toContain("keyword-volume");
    expect(prepass?.candidateBlock).toContain("commercial-intent-share");
    expect(prepass?.candidateBlock).toContain("conversion-rate");
    // No fabricated TAM: the conversion gap keeps the estimate directional.
    expect(prepass?.candidateBlock.toLowerCase()).toContain("evidence gap");
    expect(prepass?.candidateBlock).not.toContain("keywordDemand.keywords");
    // The measured row + its permalink are present to copy into a signal.
    expect(prepass?.candidateBlock).toContain(
      "ai-native gtm operations software",
    );
    expect(prepass?.candidateBlock).toContain(
      "https://www.spyfu.com/keyword/overview/us?query=ai-native%20gtm%20operations%20software",
    );
  });
});
