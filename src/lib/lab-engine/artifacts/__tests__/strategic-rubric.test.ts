import { describe, expect, it } from "vitest";

import type { StrategicCritique } from "../artifact-envelope";
import {
  buildStrategicRubricChecklistMarkdown,
  buildStrategicRubricPromptBlock,
  scoreStrategicRubric,
  scoreStrategicRubricArtifacts,
  type StrategicRubricPropertyId,
} from "../strategic-rubric";
import { crossSectionReasoningFixtureArtifact } from "../../fixtures/cross-section-reasoning-artifact";
import { paidMediaPlanFixtureArtifact } from "../../fixtures/paid-media-plan-artifact";
import { positioningSynthesisFixtureArtifact } from "../../fixtures/positioning-synthesis-artifact";

const allProperties = {
  contrarian_thesis: true,
  cross_section_thread: true,
  named_tension_with_side: true,
  second_order_implication: true,
  sequenced_moves: true,
  kill_criteria: true,
  knew_that_pass_rate: true,
  conviction_without_false_certainty: true,
} satisfies Record<StrategicRubricPropertyId, boolean>;

const passingCritique: StrategicCritique = {
  checkedAt: "2026-06-04T13:00:00.000Z",
  items: [
    {
      action: "kept",
      path: "body.crossSectionThreads[0].claim",
      rationale: "This claim names the strategic trade-off.",
      text: crossSectionReasoningFixtureArtifact.body.crossSectionThreads[0].claim,
      verdict: "passes",
    },
    {
      action: "deepened",
      path: "body.namedTension.side",
      rationale: "This claim chooses a side and cost.",
      text: crossSectionReasoningFixtureArtifact.body.namedTension.side,
      verdict: "passes",
    },
    {
      action: "cut",
      path: "body.crossSectionThreads[1].claim",
      rationale: "This one read too much like a summary.",
      text: crossSectionReasoningFixtureArtifact.body.crossSectionThreads[1].claim,
      verdict: "summary",
    },
    {
      action: "cut",
      path: "body.crossSectionThreads[2].claim",
      rationale: "This one needed stronger evidence.",
      text: crossSectionReasoningFixtureArtifact.body.crossSectionThreads[2].claim,
      verdict: "unsupported",
    },
  ],
  modelId: "claude-opus-4-5",
  summary: "Two strategic claims passed the knew-that sweep.",
  target: "cross_section_reasoning",
};

describe("strategic rubric", (): void => {
  it("passes the 9/10 gate when every strategic property is present", (): void => {
    const result = scoreStrategicRubric({
      properties: allProperties,
      knewThat: { passingSentences: 4, totalSentences: 8 },
    });

    expect(result.score).toBe(10);
    expect(result.gate).toBe("passes_9_of_10_gate");
    expect(result.knewThatPassShare).toBe(0.5);
    expect(result.activeDisqualifiers).toEqual([]);
  });

  it("scores committed T7 and T9 artifacts with evidence pointers", (): void => {
    const result = scoreStrategicRubricArtifacts({
      crossSectionReasoning: {
        ...crossSectionReasoningFixtureArtifact,
        strategicCritique: passingCritique,
      },
      positioningPaidMediaPlan: paidMediaPlanFixtureArtifact,
      positioningSynthesis: positioningSynthesisFixtureArtifact,
    });

    expect(result.score).toBe(10);
    expect(result.gate).toBe("passes_9_of_10_gate");
    expect(result.propertyResults.every((item) => item.passed)).toBe(true);
    expect(
      result.propertyResults.find((item) => item.id === "cross_section_thread")
        ?.evidencePointers,
    ).toContain("positioningCrossSectionReasoning.body.crossSectionThreads");
  });

  it("caps outputs with no cross-section thread at 6 without throwing", (): void => {
    const result = scoreStrategicRubricArtifacts({
      crossSectionReasoning: null,
      positioningPaidMediaPlan: paidMediaPlanFixtureArtifact,
      positioningSynthesis: positioningSynthesisFixtureArtifact,
      strategicCritique: passingCritique,
    });

    expect(result.score).toBe(6);
    expect(result.maxAllowedScore).toBe(6);
    expect(result.gate).toBe("below_9_of_10_gate");
    expect(result.activeDisqualifiers.map((item) => item.id)).toContain(
      "no_cross_section_thread",
    );
    expect(
      result.propertyResults.find((item) => item.id === "cross_section_thread")
        ?.note,
    ).toContain("Missing cross-section reasoning artifact");
  });

  it("marks missing critic metadata as a non-blocking knew-that checklist gap", (): void => {
    const result = scoreStrategicRubricArtifacts({
      crossSectionReasoning: crossSectionReasoningFixtureArtifact,
      positioningPaidMediaPlan: paidMediaPlanFixtureArtifact,
      positioningSynthesis: positioningSynthesisFixtureArtifact,
    });

    expect(result.score).toBe(8);
    expect(result.gate).toBe("below_9_of_10_gate");
    expect(result.knewThatPassShare).toBeNull();
    expect(
      result.propertyResults.find((item) => item.id === "knew_that_pass_rate")
        ?.note,
    ).toContain("No strategicCritique metadata available");
  });

  it("applies explicit disqualifier ceilings", (): void => {
    const result = scoreStrategicRubric({
      properties: allProperties,
      disqualifiers: { reads_like_wikipedia_brief: true },
      knewThat: { passingSentences: 6, totalSentences: 8 },
    });

    expect(result.score).toBe(5);
    expect(result.maxAllowedScore).toBe(5);
    expect(result.activeDisqualifiers.map((item) => item.id)).toEqual([
      "reads_like_wikipedia_brief",
    ]);
  });

  it("derives the knew-that property from sentence pass share when provided", (): void => {
    const result = scoreStrategicRubric({
      properties: {
        ...allProperties,
        knew_that_pass_rate: true,
      },
      knewThat: { passingSentences: 1, totalSentences: 4 },
    });

    expect(result.knewThatPassShare).toBe(0.25);
    expect(
      result.propertyResults.find((item) => item.id === "knew_that_pass_rate")
        ?.passed,
    ).toBe(false);
    expect(result.gate).toBe("below_9_of_10_gate");
  });

  it("renders a human checklist and model prompt block from the same rubric", (): void => {
    expect(buildStrategicRubricChecklistMarkdown()).toContain(
      "9/10 Strategic Rubric",
    );
    expect(buildStrategicRubricChecklistMarkdown()).toContain(
      "Contrarian thesis",
    );
    expect(buildStrategicRubricPromptBlock()).toContain(
      "Disqualifier ceilings",
    );
    expect(buildStrategicRubricPromptBlock()).toContain(
      "at least 40% of reviewed strategic sentences must pass",
    );
  });
});
