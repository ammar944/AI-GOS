import { describe, expect, it } from "vitest";

import { demandIntentFixtureArtifact } from "../../../fixtures/demand-intent-artifact";
import {
  DEMAND_INTENT_SPYFU_TOOLGAP_SOURCE_TITLE,
  DEMAND_INTENT_SPYFU_TOOLGAP_SOURCE_URL,
  DEMAND_INTENT_SPYFU_TOOLGAP_VOLUME,
  checkDemandIntentKeywordProvenance,
  keywordSignalSchema,
  softenDemandIntentForSpyFuToolGap,
  validateDemandIntentMinimums,
  type DemandIntentArtifact,
  type DemandIntentBlockGap,
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

function fixtureKeywordNames(): string[] {
  return demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
    (keyword) => keyword.keyword,
  );
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
      keywordVolumeKeywords: fixtureKeywordNames(),
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects SpyFu-estimated rows when keyword_volume did NOT succeed", (): void => {
    const result = checkDemandIntentKeywordProvenance({
      artifact: demandIntentFixtureArtifact,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // Errors name the offending row index.
    expect(result.errors.join(" ")).toContain(
      "body.keywordDemand.keywords[0]",
    );
  });

  it("rejects model-estimated rows when keyword tools failed", (): void => {
    const modelEstimated = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
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
          keywords: modelEstimated,
        },
      },
    };

    const result = checkDemandIntentKeywordProvenance({
      artifact,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("model-estimated keyword economics");
  });

  it("accepts SearchAPI Google Trends rows when keyword_trends succeeded", (): void => {
    const trendBacked = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword) => ({
        ...keyword,
        monthlyVolume: "relative interest 42/100 (SearchAPI Google Trends)",
        cpc: undefined,
        monthlyVolumeValue: undefined,
        cpcValue: undefined,
        difficulty: undefined,
        sourceTitle: "SearchAPI Google Trends",
        sourceUrl:
          "https://trends.google.com/trends/explore?date=today+12-m&geo=US&q=founder+sales",
      }),
    );
    const artifact: DemandIntentArtifact = {
      ...demandIntentFixtureArtifact,
      body: {
        ...demandIntentFixtureArtifact.body,
        keywordDemand: {
          ...demandIntentFixtureArtifact.body.keywordDemand,
          keywords: trendBacked,
        },
      },
    };

    const result = checkDemandIntentKeywordProvenance({
      artifact,
      keywordTrendKeywords: fixtureKeywordNames(),
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects Trends rows for keywords that keyword_trends did not return", (): void => {
    const trendBacked = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword) => ({
        ...keyword,
        monthlyVolume: "relative interest 42/100 (SearchAPI Google Trends)",
        cpc: undefined,
        monthlyVolumeValue: undefined,
        cpcValue: undefined,
        difficulty: undefined,
        sourceTitle: "SearchAPI Google Trends",
        sourceUrl:
          "https://trends.google.com/trends/explore?date=today+12-m&geo=US&q=founder+sales",
      }),
    );
    const artifact: DemandIntentArtifact = {
      ...demandIntentFixtureArtifact,
      body: {
        ...demandIntentFixtureArtifact.body,
        keywordDemand: {
          ...demandIntentFixtureArtifact.body.keywordDemand,
          keywords: trendBacked,
        },
      },
    };

    const result = checkDemandIntentKeywordProvenance({
      artifact,
      keywordTrendKeywords: [fixtureKeywordNames()[0] ?? ""],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "keyword_trends did not return that keyword",
    );
  });

  it("rejects model-estimated rows even when keyword_trends returned the keyword", (): void => {
    const keywords = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword) => ({
        ...keyword,
        monthlyVolume: "320 (model estimate)",
        cpc: undefined,
        monthlyVolumeValue: undefined,
        cpcValue: undefined,
        difficulty: undefined,
      }),
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
      keywordTrendKeywords: fixtureKeywordNames(),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("model-estimated keyword economics");
  });

  it("rejects CPC and numeric siblings when only keyword_trends returned the keyword", (): void => {
    const keywords = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword) => ({
        ...keyword,
        monthlyVolume: "relative interest 42/100 (SearchAPI Google Trends)",
        cpc: "$4.10",
        monthlyVolumeValue: 42,
        cpcValue: 4.1,
        difficulty: 22,
        sourceTitle: "SearchAPI Google Trends",
        sourceUrl:
          "https://trends.google.com/trends/explore?date=today+12-m&geo=US&q=founder+sales",
      }),
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
      keywordTrendKeywords: fixtureKeywordNames(),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "without matching keyword_volume data",
    );
  });

  it("rejects a SpyFu-claimed cpc when keyword_volume failed", (): void => {
    const keywords = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword, index) =>
        index === 0
          ? {
              ...keyword,
              monthlyVolume: "data gap (SpyFu and SearchAPI Trends unavailable)",
              cpc: "$4.10 (SpyFu-estimated)",
            }
          : {
              ...keyword,
              monthlyVolume: "data gap (SpyFu and SearchAPI Trends unavailable)",
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
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.keywordDemand.keywords[0]",
    );
  });
});

describe("checkDemandIntentKeywordProvenance — SpyFu ToolGap soften (T2a)", (): void => {
  it("does NOT error and marks every SpyFu row softenable under a ToolGap", (): void => {
    // keyword_volume returned a ToolGap (no keywords). The fixture's 10
    // SpyFu-estimated rows must soften, not hard-fail.
    const result = checkDemandIntentKeywordProvenance({
      artifact: demandIntentFixtureArtifact,
      spyFuToolGap: true,
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.softenableRowIndexes).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("still HARD-FAILS a fabrication (model estimate) even under a ToolGap", (): void => {
    const keywords = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword) => ({
        ...keyword,
        monthlyVolume: "320 (model estimate)",
        monthlyVolumeValue: undefined,
        difficulty: undefined,
      }),
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
      spyFuToolGap: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("model-estimated keyword economics");
  });

  it("the softened artifact re-passes provenance (clean) AND minimums", (): void => {
    const result = checkDemandIntentKeywordProvenance({
      artifact: demandIntentFixtureArtifact,
      spyFuToolGap: true,
    });
    const softened = softenDemandIntentForSpyFuToolGap({
      artifact: demandIntentFixtureArtifact,
      softenableRowIndexes: result.softenableRowIndexes,
    });

    // Rows are relabeled to the explicit data-gap marker and numerics dropped.
    softened.body.keywordDemand.keywords.forEach((keyword, index) => {
      expect(keyword.monthlyVolume).toBe(DEMAND_INTENT_SPYFU_TOOLGAP_VOLUME);
      expect(keyword.monthlyVolumeValue).toBeUndefined();
      expect(keyword.cpc).toBeUndefined();
      expect(keyword.cpcValue).toBeUndefined();
      expect(keyword.difficulty).toBeUndefined();
      // Non-SpyFu source fields are kept untouched — never overwritten with
      // an internal tool diagnostic string.
      expect(keyword.sourceTitle).toBe(
        demandIntentFixtureArtifact.body.keywordDemand.keywords[index]
          .sourceTitle,
      );
      expect(keyword.sourceUrl).toBe(
        demandIntentFixtureArtifact.body.keywordDemand.keywords[index]
          .sourceUrl,
      );
    });

    // Re-run provenance with NO tool keywords (the ToolGap persists) — clean.
    const recheck = checkDemandIntentKeywordProvenance({ artifact: softened });
    expect(recheck.ok).toBe(true);
    expect(recheck.errors).toHaveLength(0);

    // And the softened artifact still clears section minimums (10 keywords,
    // no "not disclosed").
    expect(validateDemandIntentMinimums(softened).ok).toBe(true);
  });

  it("neutralizes SpyFu provenance leaked into sourceTitle/sourceUrl", (): void => {
    const keywords = demandIntentFixtureArtifact.body.keywordDemand.keywords.map(
      (keyword) => ({
        ...keyword,
        sourceTitle: "SpyFu keyword export",
        sourceUrl: "https://www.spyfu.com/keyword/overview",
      }),
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

    const provenance = checkDemandIntentKeywordProvenance({
      artifact,
      spyFuToolGap: true,
    });
    const softened = softenDemandIntentForSpyFuToolGap({
      artifact,
      softenableRowIndexes: provenance.softenableRowIndexes,
    });

    softened.body.keywordDemand.keywords.forEach((keyword) => {
      expect(/spyfu/i.test(keyword.sourceTitle)).toBe(false);
      expect(/spyfu/i.test(keyword.sourceUrl)).toBe(false);
      // The replacements name the missing market evidence — never the
      // internal tool diagnostic string that used to leak into these fields.
      expect(keyword.sourceTitle).toBe(DEMAND_INTENT_SPYFU_TOOLGAP_SOURCE_TITLE);
      expect(keyword.sourceUrl).toBe(DEMAND_INTENT_SPYFU_TOOLGAP_SOURCE_URL);
      expect(/keyword_volume|tool data gap/i.test(keyword.sourceTitle)).toBe(
        false,
      );
      expect(/keyword_volume|tool data gap/i.test(keyword.sourceUrl)).toBe(
        false,
      );
    });
    // The relabeled artifact is provenance-clean.
    expect(
      checkDemandIntentKeywordProvenance({ artifact: softened }).ok,
    ).toBe(true);
  });
});

describe("validateDemandIntentMinimums — blockGap honest-shortfall escape", (): void => {
  const blockGap: DemandIntentBlockGap = {
    summary: "evidence gap: no verbatim buyer questions found on public surfaces",
    foundCount: 0,
    requiredCount: 10,
    sourcingPlan: ["Mine competitor community threads next run."],
  };

  function withQuestionMining(
    questionMining: DemandIntentArtifact["body"]["questionMining"],
  ): DemandIntentArtifact {
    return {
      ...demandIntentFixtureArtifact,
      body: { ...demandIntentFixtureArtifact.body, questionMining },
    };
  }

  function withIntentSignals(
    intentSignals: DemandIntentArtifact["body"]["intentSignals"],
  ): DemandIntentArtifact {
    return {
      ...demandIntentFixtureArtifact,
      body: { ...demandIntentFixtureArtifact.body, intentSignals },
    };
  }

  it("accepts questions: [] with a blockGap instead of invented questions", (): void => {
    const result = validateDemandIntentMinimums(
      withQuestionMining({
        prose: demandIntentFixtureArtifact.body.questionMining.prose,
        questions: [],
        blockGap,
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects an empty questions list WITHOUT a blockGap and names the escape", (): void => {
    const result = validateDemandIntentMinimums(
      withQuestionMining({
        prose: demandIntentFixtureArtifact.body.questionMining.prose,
        questions: [],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.questionMining.questions: have 0, need >=10.",
    );
    expect(result.errors.join(" ")).toContain("blockGap");
  });

  it("rejects a partially-filled questions list even WITH a blockGap (floor stays all-or-nothing)", (): void => {
    const result = validateDemandIntentMinimums(
      withQuestionMining({
        prose: demandIntentFixtureArtifact.body.questionMining.prose,
        questions: demandIntentFixtureArtifact.body.questionMining.questions.slice(
          0,
          4,
        ),
        blockGap,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.questionMining.questions: have 4, need >=10.",
    );
  });

  it("accepts items: [] with a blockGap for intentSignals", (): void => {
    const result = validateDemandIntentMinimums(
      withIntentSignals({
        prose: demandIntentFixtureArtifact.body.intentSignals.prose,
        items: [],
        blockGap: { ...blockGap, requiredCount: 5 },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects an empty intentSignals list WITHOUT a blockGap and names the escape", (): void => {
    const result = validateDemandIntentMinimums(
      withIntentSignals({
        prose: demandIntentFixtureArtifact.body.intentSignals.prose,
        items: [],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.intentSignals.items: have 0, need >=5.",
    );
    expect(result.errors.join(" ")).toContain("blockGap");
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

// Diversity quotas (>=2 surface/signal/venue types) were validator floors that
// run 314d5f02 proved are only ever satisfied by INVENTING rows: with real
// single-surface mining, the section hard-failed. Diversity is prompt-side
// guidance now; honesty floors (counts + blockGap escape) remain.
describe("validateDemandIntentMinimums — diversity is guidance, not a floor", (): void => {
  const venueBlockGap: DemandIntentBlockGap = {
    summary: "evidence gap: no public venues with displayed audience counts found",
    foundCount: 1,
    requiredCount: 4,
    sourcingPlan: ["Probe podcast directories and Slack community indexes next run."],
  };

  it("accepts 10+ real questions all from ONE surface", (): void => {
    const questions =
      demandIntentFixtureArtifact.body.questionMining.questions.map(
        (question) => ({ ...question, surface: "reddit" as const }),
      );
    const result = validateDemandIntentMinimums({
      ...demandIntentFixtureArtifact,
      body: {
        ...demandIntentFixtureArtifact.body,
        questionMining: {
          ...demandIntentFixtureArtifact.body.questionMining,
          questions,
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts 4+ real venues all of ONE venueType", (): void => {
    const venues = demandIntentFixtureArtifact.body.venueMap.venues.map(
      (venue) => ({ ...venue, venueType: "community" as const }),
    );
    const result = validateDemandIntentMinimums({
      ...demandIntentFixtureArtifact,
      body: {
        ...demandIntentFixtureArtifact.body,
        venueMap: { ...demandIntentFixtureArtifact.body.venueMap, venues },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts venues: [] with a blockGap instead of invented venues", (): void => {
    const result = validateDemandIntentMinimums({
      ...demandIntentFixtureArtifact,
      body: {
        ...demandIntentFixtureArtifact.body,
        venueMap: {
          prose: demandIntentFixtureArtifact.body.venueMap.prose,
          venues: [],
          blockGap: venueBlockGap,
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a thin venue list even WITH a blockGap (floor stays all-or-nothing)", (): void => {
    const result = validateDemandIntentMinimums({
      ...demandIntentFixtureArtifact,
      body: {
        ...demandIntentFixtureArtifact.body,
        venueMap: {
          prose: demandIntentFixtureArtifact.body.venueMap.prose,
          venues: demandIntentFixtureArtifact.body.venueMap.venues.slice(0, 2),
          blockGap: venueBlockGap,
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "body.venueMap.venues: have 2, need >=4.",
    );
    expect(result.errors.join(" ")).toContain("blockGap");
  });
});
