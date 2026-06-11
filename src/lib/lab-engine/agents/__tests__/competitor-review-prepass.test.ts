import { describe, expect, it } from "vitest";

import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import type { RunSectionDeps, RunSectionInput } from "../run-section";
import { buildCompetitorReviewPrepass } from "../run-section";

// Competitor review-permalink prepass (run 8081e646 cold-judge fix): the W5
// VoC permalink machinery pointed at the brief's top competitors, so
// publicWeaknesses can carry real per-review permalinks instead of index-page
// paraphrases.

const deps = {
  now: () => new Date("2026-06-11T12:00:00.000Z"),
} as unknown as RunSectionDeps;

const input = {
  runId: "run-competitor-review-prepass",
  sectionId: "positioningCompetitorLandscape",
} as unknown as RunSectionInput;

const g2Permalink =
  "https://www.g2.com/products/notion/reviews/notion-review-1234567";

function reviewsToolReturning(
  perBrand: (brand: string) => unknown,
): Record<string, unknown> {
  const calls: unknown[] = [];

  return {
    calls,
    reviews: {
      execute: async (toolInput: { brand: string }): Promise<unknown> => {
        calls.push(toolInput);
        return perBrand(toolInput.brand);
      },
    },
  };
}

function withSeeds(
  seeds: Array<{ name: string; domain?: string }>,
): typeof saaslaunchResearchInput {
  return { ...saaslaunchResearchInput, competitorSeeds: seeds };
}

describe("buildCompetitorReviewPrepass", () => {
  it("surfaces permalink-bearing verbatim quotes and filters index-page excerpts", async () => {
    const researchTools = reviewsToolReturning((brand) => ({
      type: "result",
      brand,
      excerpts: [
        {
          source: "G2",
          url: g2Permalink,
          snippet: "Gets slow with big databases",
          reviewText:
            "Notion gets painfully slow once our wiki passed a few thousand pages.",
          reviewer: "Ops lead",
          date: "2026-04-02",
        },
        {
          // Index page: must never be offered as a verbatim source.
          source: "G2",
          url: "https://www.g2.com/products/notion/reviews",
          snippet: "index page snippet",
          reviewText: "Looks verbatim but the URL cannot carry it.",
        },
        {
          // Permalink without a scraped body: snippet-only, not verbatim.
          source: "G2",
          url: "https://www.g2.com/products/notion/reviews/notion-review-7654321",
          snippet: "snippet only",
        },
      ],
    }));

    const prepass = await buildCompetitorReviewPrepass({
      deps,
      input,
      researchInput: withSeeds([{ name: "Notion", domain: "notion.so" }]),
      researchTools,
    });

    expect(prepass).toBeDefined();
    expect(prepass?.steps).toHaveLength(1);
    expect(prepass?.steps[0]?.toolCalls[0]?.toolName).toBe("reviews");
    expect(prepass?.steps[0]?.toolCalls[0]?.input).toEqual({
      brand: "Notion",
      max_body_pages: 2,
      max_results: 5,
      mode: "bodies",
    });

    expect(prepass?.candidateBlock).toContain("COMPETITOR REVIEW PREPASS");
    expect(prepass?.candidateBlock).toContain(
      "may ONLY be copied exactly from the quotes below",
    );
    expect(prepass?.candidateBlock).toContain(g2Permalink);
    expect(prepass?.candidateBlock).toContain(
      "painfully slow once our wiki passed",
    );
    expect(prepass?.candidateBlock).toContain("(Ops lead, 2026-04-02)");
    // The index page and the body-less permalink never appear as quotes.
    expect(prepass?.candidateBlock).not.toContain(
      "Looks verbatim but the URL cannot carry it.",
    );
    expect(prepass?.candidateBlock).not.toContain("notion-review-7654321");
  });

  it("tells the agent to paraphrase honestly when no permalinks come back", async () => {
    const researchTools = reviewsToolReturning(() => ({
      type: "gap",
      message: "SearchAPI exhausted",
    }));

    const prepass = await buildCompetitorReviewPrepass({
      deps,
      input,
      researchInput: withSeeds([{ name: "Notion" }]),
      researchTools,
    });

    expect(prepass?.steps).toHaveLength(1);
    expect(prepass?.candidateBlock).toContain("## Notion");
    expect(prepass?.candidateBlock).toContain(
      "no per-review permalinks retrieved",
    );
    expect(prepass?.candidateBlock).toContain("never label it verbatim");
  });

  it("caps the prepass at the top three seeded competitors", async () => {
    const researchTools = reviewsToolReturning(() => ({
      type: "gap",
      message: "none",
    }));

    const prepass = await buildCompetitorReviewPrepass({
      deps,
      input,
      researchInput: withSeeds([
        { name: "Notion" },
        { name: "monday.com" },
        { name: "ClickUp" },
        { name: "Smartsheet" },
      ]),
      researchTools,
    });

    expect(prepass?.steps).toHaveLength(3);
    expect(researchTools.calls).toHaveLength(3);
    expect(prepass?.candidateBlock).toContain("## ClickUp");
    expect(prepass?.candidateBlock).not.toContain("## Smartsheet");
  });

  it("degrades to the honesty contract with no steps when the tool is absent", async () => {
    const prepass = await buildCompetitorReviewPrepass({
      deps,
      input,
      researchInput: withSeeds([{ name: "Notion" }]),
      researchTools: {},
    });

    expect(prepass?.steps).toHaveLength(0);
    expect(prepass?.candidateBlock).toContain(
      "never labeled verbatim",
    );
  });

  it("returns undefined when the brief seeded no competitors", async () => {
    const prepass = await buildCompetitorReviewPrepass({
      deps,
      input,
      researchInput: withSeeds([]),
      researchTools: {},
    });

    expect(prepass).toBeUndefined();
  });
});
