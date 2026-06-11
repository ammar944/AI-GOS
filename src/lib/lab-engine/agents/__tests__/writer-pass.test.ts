import { describe, expect, it, vi } from "vitest";

import type { SectionOutput } from "@/lib/lab-engine/sections/section-registry";
import type { SectionLanguageModel } from "@/lib/lab-engine/ai/models";

import type { StructuredCaller } from "../section-agent";
import {
  collectNarrativeRewriteTargets,
  defaultSectionWriterPassRunner,
  sectionWriterPassFloorMs,
} from "../writer-pass";

const dummyModel = {} as SectionLanguageModel;

function buildOutput(): SectionOutput<Record<string, unknown>> {
  return {
    sectionTitle: "Market Category & Growth Dynamics",
    verdict: "The category is winnable on paid search before education spend.",
    statusSummary: "A dense single-paragraph summary of the section findings.",
    confidence: 0.7,
    sources: [],
    body: {
      categoryDefinition: {
        prose: "Draft category definition prose.",
        adjacentCategories: [
          {
            name: "Adjacent",
            whyBuyersConfuseIt:
              "A long prose-like string inside an evidence row that must never be rewritten.",
          },
        ],
      },
      marketSize: {
        prose: "evidence gap: no defensible TAM signals were retrievable.",
        signals: [],
      },
      strategicInsight: {
        strategicVerdict: "Bet the budget on bottom-funnel comparison terms.",
        nonObviousRead: "The real competitor is the spreadsheet status quo.",
        secondOrderImplication: "Winning comparisons raises branded CPCs later.",
        keyTension: {
          tension: "Education spend versus harvest spend.",
          side: "Harvest existing demand first.",
          costOfPosition: "Concedes category narrative to incumbents.",
        },
      },
      nested: {
        deeper: {
          prose: "Deeply nested prose field.",
        },
      },
      looseLabel: "A loose string field that is not a narrative slot.",
    },
  };
}

describe("collectNarrativeRewriteTargets", (): void => {
  it("collects verdict, statusSummary, prose fields, and the strategicInsight subtree", (): void => {
    const targets = collectNarrativeRewriteTargets(buildOutput());
    const paths = targets.map((target) => target.path);

    expect(paths).toEqual([
      "verdict",
      "statusSummary",
      "body.categoryDefinition.prose",
      "body.strategicInsight.strategicVerdict",
      "body.strategicInsight.nonObviousRead",
      "body.strategicInsight.secondOrderImplication",
      "body.strategicInsight.keyTension.tension",
      "body.strategicInsight.keyTension.side",
      "body.strategicInsight.keyTension.costOfPosition",
      "body.nested.deeper.prose",
    ]);
  });

  it("skips evidence-gap sentinels, array contents, and non-narrative strings", (): void => {
    const paths = collectNarrativeRewriteTargets(buildOutput()).map(
      (target) => target.path,
    );

    expect(paths).not.toContain("body.marketSize.prose");
    expect(paths.some((path) => path.includes("adjacentCategories"))).toBe(
      false,
    );
    expect(paths).not.toContain("body.looseLabel");
  });

  it("skips empty narrative values", (): void => {
    const output = buildOutput();
    output.statusSummary = "   ";

    const paths = collectNarrativeRewriteTargets(output).map(
      (target) => target.path,
    );

    expect(paths).not.toContain("statusSummary");
  });
});

describe("defaultSectionWriterPassRunner", (): void => {
  const baseParams = {
    sectionId: "positioningMarketCategory",
    sectionTitle: "Market Category & Growth Dynamics",
    mission: "Establish the category frame the buyer already shops in.",
    companyName: "SaaSLaunch",
    companyWebsiteUrl: "https://saaslaunch.example",
    remainingMs: null,
    enabled: true,
    model: dummyModel,
  };

  it("returns the original output untouched when the pen is disabled", async (): Promise<void> => {
    const output = buildOutput();
    const callStructured = vi.fn<StructuredCaller>();

    const result = await defaultSectionWriterPassRunner({
      ...baseParams,
      output,
      enabled: false,
      callStructured,
    });

    expect(result.applied).toBe(false);
    expect(result.skipReason).toBe("writer_pen_disabled");
    expect(result.output).toBe(output);
    expect(callStructured).not.toHaveBeenCalled();
  });

  it("skips when the remaining deadline budget is below the floor", async (): Promise<void> => {
    const output = buildOutput();
    const callStructured = vi.fn<StructuredCaller>();

    const result = await defaultSectionWriterPassRunner({
      ...baseParams,
      output,
      remainingMs: sectionWriterPassFloorMs - 1,
      callStructured,
    });

    expect(result.applied).toBe(false);
    expect(result.skipReason).toContain("deadline");
    expect(callStructured).not.toHaveBeenCalled();
  });

  it("splices rewritten fields into a clone and leaves evidence rows intact", async (): Promise<void> => {
    const output = buildOutput();
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      expect(params.schemaName).toBe("SectionNarrativeRewrite");
      expect(params.prompt).toContain("FULL SECTION DRAFT");
      expect(params.prompt).toContain("body.categoryDefinition.prose");

      return {
        verdict: "Penned verdict: harvest bottom-funnel demand first.",
        statusSummary: output.statusSummary,
        "body.categoryDefinition.prose": "Penned category definition prose.",
        "body.strategicInsight.strategicVerdict": "Penned strategic verdict.",
        "body.strategicInsight.nonObviousRead":
          "Penned non-obvious read about the spreadsheet status quo.",
        "body.strategicInsight.secondOrderImplication":
          "Penned second-order implication.",
        "body.strategicInsight.keyTension.tension": "Penned tension.",
        "body.strategicInsight.keyTension.side": "Penned side.",
        "body.strategicInsight.keyTension.costOfPosition": "Penned cost.",
        "body.nested.deeper.prose": "Penned deep prose.",
      };
    });

    const result = await defaultSectionWriterPassRunner({
      ...baseParams,
      output,
      callStructured,
    });

    expect(result.applied).toBe(true);
    expect(result.rewrittenFieldCount).toBe(9);
    expect(result.output).not.toBe(output);
    expect(result.output.verdict).toBe(
      "Penned verdict: harvest bottom-funnel demand first.",
    );
    // Identical replacement is not counted as a rewrite.
    expect(result.output.statusSummary).toBe(output.statusSummary);

    const body = result.output.body as Record<string, never>;
    expect(body.categoryDefinition).toMatchObject({
      prose: "Penned category definition prose.",
    });
    // Evidence rows and sentinels are untouched.
    expect(body.categoryDefinition).toMatchObject({
      adjacentCategories: (output.body.categoryDefinition as {
        adjacentCategories: unknown;
      }).adjacentCategories,
    });
    expect(body.marketSize).toMatchObject({
      prose: "evidence gap: no defensible TAM signals were retrievable.",
    });
    // The original draft is never mutated.
    expect(output.verdict).toBe(
      "The category is winnable on paid search before education spend.",
    );
    expect(
      (output.body.categoryDefinition as { prose: string }).prose,
    ).toBe("Draft category definition prose.");
  });

  it("keeps the original draft when the structured call fails", async (): Promise<void> => {
    const output = buildOutput();
    const callStructured = vi.fn<StructuredCaller>(async () => {
      throw new Error("model unavailable");
    });

    const result = await defaultSectionWriterPassRunner({
      ...baseParams,
      output,
      callStructured,
    });

    expect(result.applied).toBe(false);
    expect(result.skipReason).toContain("writer_pass_failed");
    expect(result.skipReason).toContain("model unavailable");
    expect(result.output).toBe(output);
  });

  it("ignores empty and non-string replacements", async (): Promise<void> => {
    const output = buildOutput();
    const callStructured = vi.fn<StructuredCaller>(async () => ({
      verdict: "   ",
      statusSummary: 42,
      "body.categoryDefinition.prose": "Penned prose only.",
    }));

    const result = await defaultSectionWriterPassRunner({
      ...baseParams,
      output,
      callStructured,
    });

    expect(result.applied).toBe(true);
    expect(result.rewrittenFieldCount).toBe(1);
    expect(result.output.verdict).toBe(output.verdict);
    expect(result.output.statusSummary).toBe(output.statusSummary);
  });

  it("skips when the rewrite changes nothing", async (): Promise<void> => {
    const output = buildOutput();
    const callStructured = vi.fn<StructuredCaller>(async () =>
      Object.fromEntries(
        collectNarrativeRewriteTargets(output).map((target) => [
          target.path,
          target.value,
        ]),
      ),
    );

    const result = await defaultSectionWriterPassRunner({
      ...baseParams,
      output,
      callStructured,
    });

    expect(result.applied).toBe(false);
    expect(result.skipReason).toBe("no_fields_rewritten");
    expect(result.output).toBe(output);
  });
});
