import { describe, expect, it } from "vitest";

import {
  decodePaidMediaPlanFromText,
  type ComposePaidMediaPlanResult,
} from "@/lib/lab-engine/agents/composer-glm";
import { buildComposedPaidMediaArtifact } from "@/lib/lab-engine/agents/run-section";
import { paidMediaPlanBodySchema } from "@/lib/lab-engine/artifacts/schemas/paid-media-plan";
import type { RunSectionDeps, RunSectionInput } from "@/lib/lab-engine/agents/run-section";
import type { RuntimeSectionDefinition } from "@/lib/lab-engine/agents/run-section";

// A schema-valid PaidMediaPlanBody: the honest-gap shell the decoder produces on
// a parse miss is a real, floor-satisfying deck body — reuse it as the deck for
// every case so only deckSource / finishReason vary.
const VALID_DECK = decodePaidMediaPlanFromText(
  "just prose, the model forgot the fenced JSON block",
).deck;

const DEFINITION = {
  title: "Paid Media Plan",
  bodySchema: paidMediaPlanBodySchema,
} as unknown as RuntimeSectionDefinition;

const INPUT = {
  runId: "run-1",
  sectionId: "positioningPaidMediaPlan",
} as RunSectionInput;

const DEPS = {
  now: () => new Date("2026-06-24T00:00:00.000Z"),
  newId: () => "composer-test-id",
} as unknown as RunSectionDeps;

function makeResult(
  overrides: Partial<ComposePaidMediaPlanResult>,
): ComposePaidMediaPlanResult {
  return {
    deck: VALID_DECK,
    deckSource: "decoded",
    deckMarkdown: "# Paid Media Plan\n\nThe billable deck narrative.",
    transcript: [],
    stepCount: 1,
    finishReason: "stop",
    ...overrides,
  };
}

describe("run-section — buildComposedPaidMediaArtifact", () => {
  it("commits a DECODED deck as an admitted artifact (narrativeMarkdown preserved, not flagged)", () => {
    const artifact = buildComposedPaidMediaArtifact({
      composerResult: makeResult({ deckSource: "decoded", finishReason: "stop" }),
      definition: DEFINITION,
      input: INPUT,
      deps: DEPS,
      fallbackUrl: "https://attio.com",
    });

    expect(artifact.sectionId).toBe("positioningPaidMediaPlan");
    expect(artifact.needs_review).toBeFalsy();
    expect(artifact.confidence).toBe(0.6);
    expect((artifact.body as { narrativeMarkdown?: string }).narrativeMarkdown).toBe(
      "# Paid Media Plan\n\nThe billable deck narrative.",
    );
    expect(artifact.sources.length).toBeGreaterThanOrEqual(1);
  });

  it("FLAGS an honest_gap deck for review (never a clean composed deck)", () => {
    const artifact = buildComposedPaidMediaArtifact({
      composerResult: makeResult({ deckSource: "honest_gap", finishReason: "stop" }),
      definition: DEFINITION,
      input: INPUT,
      deps: DEPS,
      fallbackUrl: "https://attio.com",
    });

    expect(artifact.needs_review).toBe(true);
    expect(artifact.confidence).toBe(0.4);
  });

  it("FLAGS a length-truncated deck for review even if it decoded", () => {
    const artifact = buildComposedPaidMediaArtifact({
      composerResult: makeResult({ deckSource: "decoded", finishReason: "length" }),
      definition: DEFINITION,
      input: INPUT,
      deps: DEPS,
      fallbackUrl: "https://attio.com",
    });

    expect(artifact.needs_review).toBe(true);
    expect(artifact.confidence).toBe(0.4);
  });
});
