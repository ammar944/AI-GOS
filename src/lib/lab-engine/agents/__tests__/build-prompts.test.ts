import { describe, expect, it } from "vitest";

import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import {
  buildAnswerToolInstructions,
  type PromptSectionDefinition,
} from "../build-prompts";

const definition = {
  title: "Market & Category Intelligence",
  mission: "Define the category and market forces.",
  outputEmphasis: ["category definition"],
  sectionOutputSchemaName: "MarketCategorySectionOutput",
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
});
