import { describe, expect, it } from "vitest";

import { SECTION_REGISTRY } from "@/lib/lab-engine/sections/section-registry";

import {
  buildSectionMinimumGuidance,
  buildStrategicDepthMinimumGuidance,
  type PromptSectionDefinition,
} from "../build-prompts";

// Characterization snapshot lock for the P4 descriptor move: the per-section
// prompt minimum-guidance text is being relocated from build-prompts if-chains
// onto SectionDefinition.{strategicDepthGuidance,promptMinimumGuidance}. These
// snapshots capture the EXACT current output for all 7 sections so the move is
// proven byte-identical (the guidance is load-bearing prompt text).
const SECTION_IDS = [
  "positioningMarketCategory",
  "positioningCompetitorLandscape",
  "positioningBuyerICP",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "positioningPaidMediaPlan",
] as const;

describe("section minimum-guidance characterization (P4 descriptor move)", () => {
  for (const id of SECTION_IDS) {
    const definition = SECTION_REGISTRY[
      id
    ] as unknown as PromptSectionDefinition;

    it(`strategicDepthGuidance for ${id} is byte-stable`, () => {
      expect(buildStrategicDepthMinimumGuidance(definition)).toMatchSnapshot();
    });

    it(`sectionMinimumGuidance for ${id} is byte-stable`, () => {
      expect(buildSectionMinimumGuidance(definition)).toMatchSnapshot();
    });
  }

  it("resolves the same guidance for a bare prompt-definition via the registry fallback", () => {
    // A literal carrying only sectionOutputSchemaName (no descriptor fields)
    // must resolve identical guidance to the full registry entry — this locks
    // the fallback path the build-prompts.test.ts literals depend on.
    const bare: PromptSectionDefinition = {
      title: "x",
      mission: "y",
      outputEmphasis: ["z"],
      sectionOutputSchemaName: "MarketCategorySectionOutput",
    };
    expect(buildSectionMinimumGuidance(bare)).toEqual(
      buildSectionMinimumGuidance(
        SECTION_REGISTRY.positioningMarketCategory as unknown as PromptSectionDefinition,
      ),
    );
  });
});
