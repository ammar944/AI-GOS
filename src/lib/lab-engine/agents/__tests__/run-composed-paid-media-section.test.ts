import { describe, expect, it, vi } from "vitest";

import {
  decodePaidMediaPlanFromText,
  type ComposePaidMediaPlanResult,
} from "@/lib/lab-engine/agents/composer-glm";
import {
  buildComposedPaidMediaArtifact,
  makeComposerProgressEmitter,
} from "@/lib/lab-engine/agents/run-section";
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
  it("commits a DECODED deck as an admitted artifact (strategistMemo preserved, not flagged)", () => {
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
    expect((artifact.body as { strategistMemo?: string }).strategistMemo).toBe(
      "# Paid Media Plan\n\nThe billable deck narrative.",
    );
    // paid-media no longer stamps narrativeMarkdown (the typed deck is primary;
    // the memo rides strategistMemo). The 6 research sections still stamp it.
    expect(
      (artifact.body as { narrativeMarkdown?: string }).narrativeMarkdown,
    ).toBeUndefined();
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

describe("run-section — makeComposerProgressEmitter", () => {
  it("increments seq per call and uses step.stepNumber when present", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const emit = makeComposerProgressEmitter({
      runId: "run-1",
      sectionId: "positioningPaidMediaPlan",
      publish,
    });

    await emit({ stepNumber: 0 });
    await emit({ stepNumber: 1 });
    await emit({ stepNumber: 2 });

    expect(publish).toHaveBeenCalledTimes(3);
    expect(publish.mock.calls[0][0].seq).toBe(1);
    expect(publish.mock.calls[1][0].seq).toBe(2);
    expect(publish.mock.calls[2][0].seq).toBe(3);
    expect(publish.mock.calls[0][0].snapshot.step).toBe(0);
    expect(publish.mock.calls[2][0].snapshot.step).toBe(2);
  });

  it("publishes the full 5-key envelope + snapshot wire contract", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const emit = makeComposerProgressEmitter({
      runId: "run-9",
      sectionId: "positioningPaidMediaPlan",
      publish,
    });

    await emit({ stepNumber: 4 });

    // The envelope is {runId, zone, sectionId, seq, snapshot}; the flat
    // {phase, step, message} lives only on the nested .snapshot field.
    expect(publish).toHaveBeenCalledWith({
      runId: "run-9",
      zone: "positioningPaidMediaPlan",
      sectionId: "positioningPaidMediaPlan",
      seq: 1,
      snapshot: {
        phase: "composing",
        step: 4,
        message: "Composing paid-media deck (step 5)",
      },
    });
  });

  it("falls back to seq-1 for the step number when the step has no stepNumber", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const emit = makeComposerProgressEmitter({
      runId: "run-1",
      sectionId: "positioningPaidMediaPlan",
      publish,
    });

    await emit(null);
    await emit({});
    await emit("not-an-object");

    expect(publish.mock.calls[0][0].snapshot.step).toBe(0);
    expect(publish.mock.calls[0][0].snapshot.message).toBe(
      "Composing paid-media deck (step 1)",
    );
    expect(publish.mock.calls[1][0].snapshot.step).toBe(1);
    expect(publish.mock.calls[2][0].snapshot.step).toBe(2);
  });

  it("swallows a rejecting publish (never rethrows) and warns once", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("realtime down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const emit = makeComposerProgressEmitter({
      runId: "run-1",
      sectionId: "positioningPaidMediaPlan",
      publish,
    });

    await expect(emit({ stepNumber: 0 })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });
});
