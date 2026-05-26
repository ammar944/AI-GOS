import { describe, expect, it } from "vitest";

import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import {
  buildAnswerToolInstructions,
  buildRepairPrompt,
  type PromptSectionDefinition,
} from "../build-prompts";

const definition = {
  title: "Market & Category Intelligence",
  mission: "Define the category and market forces.",
  outputEmphasis: ["category definition"],
  sectionOutputSchemaName: "MarketCategorySectionOutput",
} satisfies PromptSectionDefinition;

const competitorDefinition = {
  title: "Competitor Landscape & Positioning",
  mission: "Map the competitive set and positioning claims.",
  outputEmphasis: ["competitor set"],
  sectionOutputSchemaName: "CompetitorLandscapeSectionOutput",
} satisfies PromptSectionDefinition;

describe("buildAnswerToolInstructions", (): void => {
  it("adds schema-bound answer-tool guidance for DeepSeek mode", (): void => {
    const prompt = buildAnswerToolInstructions(
      definition,
      saaslaunchResearchInput,
      undefined,
      { inputSchemaMode: "section-schema" },
    );

    expect(prompt).toContain(
      "The answer tool input schema is bound to the full section schema for this model.",
    );
  });

  it("spells out Market Category validator cardinality minimums", (): void => {
    const prompt = buildAnswerToolInstructions(
      definition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain(
      "`body.marketSize.signals` must include at least three public trajectory signals",
    );
    expect(prompt).toContain(
      "`body.categoryMaturity.classification.supportingSignals` must include at least two maturity signals",
    );
  });

  it("spells out Competitor Landscape weakness coverage minimums", (): void => {
    const prompt = buildAnswerToolInstructions(
      competitorDefinition,
      saaslaunchResearchInput,
    );

    expect(prompt).toContain(
      "`body.publicWeaknesses.items` must include at least four verbatim weaknesses",
    );
    expect(prompt).toContain(
      "`body.publicWeaknesses.items` must cover at least two distinct competitors",
    );
  });

  it("repeats Competitor Landscape weakness coverage minimums in repair prompts", (): void => {
    const prompt = buildRepairPrompt({
      definition: competitorDefinition,
      evidenceTranscript: "source evidence",
      issues: [
        "body.publicWeaknesses.items: need weaknesses across >=2 competitors, have 1.",
      ],
      previousOutput: { body: { publicWeaknesses: { items: [] } } },
      researchInput: saaslaunchResearchInput,
      skillMd: "Use the injected corpus only.",
    });

    expect(prompt).toContain(
      "`body.publicWeaknesses.items` must include at least four verbatim weaknesses",
    );
    expect(prompt).toContain(
      "`body.publicWeaknesses.items` must cover at least two distinct competitors",
    );
  });
});
