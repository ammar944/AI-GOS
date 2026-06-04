import { describe, expect, it } from "vitest";

import {
  positioningSynthesisSectionOutputSchema,
  validatePositioningSynthesisMinimums,
  type PositioningSynthesisArtifact,
} from "../positioning-synthesis";
import { positioningSynthesisFixtureArtifact } from "../../../fixtures/positioning-synthesis-artifact";

function cloneFixture(): PositioningSynthesisArtifact {
  return structuredClone(positioningSynthesisFixtureArtifact);
}

describe("positioningSynthesisSectionOutputSchema", () => {
  it("parses the fixture body shape as a section output", () => {
    const { id: _id, runId: _runId, sectionId: _sectionId, createdAt: _createdAt, ...output } =
      positioningSynthesisFixtureArtifact;
    void _id;
    void _runId;
    void _sectionId;
    void _createdAt;
    const result = positioningSynthesisSectionOutputSchema.safeParse({
      ...output,
      sources: output.sources.map((source) => ({
        title: source.title,
        url: source.url,
      })),
    });
    expect(result.success).toBe(true);
  });
});

describe("validatePositioningSynthesisMinimums", () => {
  it("accepts the valid fixture", () => {
    expect(validatePositioningSynthesisMinimums(cloneFixture())).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects fewer than 2 positioning options", () => {
    const artifact = cloneFixture();
    artifact.body.positioningOptions.options =
      artifact.body.positioningOptions.options.slice(0, 1);
    // Keep recommendedMove pointing at a surviving angle.
    artifact.body.recommendedMove.optionAngle =
      artifact.body.positioningOptions.options[0].angle;
    const result = validatePositioningSynthesisMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("positioningOptions.options"))).toBe(
      true,
    );
  });

  it("rejects more than 3 positioning options", () => {
    const artifact = cloneFixture();
    const [first] = artifact.body.positioningOptions.options;
    artifact.body.positioningOptions.options = [first, first, first, first];
    const result = validatePositioningSynthesisMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("positioningOptions.options"))).toBe(
      true,
    );
  });

  it("rejects a recommended move whose optionAngle is not among the option angles", () => {
    const artifact = cloneFixture();
    artifact.body.recommendedMove.optionAngle = "An angle nobody proposed.";
    const result = validatePositioningSynthesisMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes("recommendedMove.optionAngle")),
    ).toBe(true);
  });

  it("rejects synthesis grounded entirely in the GTM brief", () => {
    const artifact = cloneFixture();
    for (const option of artifact.body.positioningOptions.options) {
      option.sourceSection = "gtmBrief";
    }
    for (const direction of artifact.body.messagingDirections.directions) {
      direction.sourceSection = "gtmBrief";
    }
    const result = validatePositioningSynthesisMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("section-grounded"))).toBe(true);
  });

  it("rejects fewer than 5 sources", () => {
    const artifact = cloneFixture();
    artifact.sources = artifact.sources.slice(0, 4);
    const result = validatePositioningSynthesisMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("sources"))).toBe(true);
  });

  it("rejects thesis source refs that do not span two distinct sections", () => {
    const artifact = cloneFixture();
    artifact.body.strategicThesis.sourceSections = [
      {
        sourceSection: "positioningVoiceOfCustomer",
        sourceUrl: "https://example.com/synthesis/source-1",
      },
      {
        sourceSection: "positioningVoiceOfCustomer",
        sourceUrl: "https://example.com/synthesis/source-2",
      },
    ];

    const result = validatePositioningSynthesisMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes("strategicThesis.sourceSections"),
      ),
    ).toBe(true);
  });

  it("rejects ordered moves with non-consecutive ranks and forward dependencies", () => {
    const artifact = cloneFixture();
    artifact.body.orderedMoves.moves[1].rank = 4;
    artifact.body.orderedMoves.moves[1].dependsOn = [3];

    const result = validatePositioningSynthesisMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes("consecutive starting at 1")),
    ).toBe(true);
    expect(
      result.errors.some((error) =>
        error.includes("dependencies must point to earlier ranks"),
      ),
    ).toBe(true);
  });

  it("rejects ordered moves without a specific thesis trace", () => {
    const artifact = cloneFixture();
    artifact.body.orderedMoves.moves[0].thesisTrace = "improve messaging";

    const result = validatePositioningSynthesisMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes("thesisTrace")),
    ).toBe(true);
  });

  it("rejects placeholder kill criteria on ordered moves", () => {
    const artifact = cloneFixture();
    artifact.body.orderedMoves.moves[0].provesWrongIf = {
      metric: "unknown",
      threshold: "n/a",
      window: "none",
    };

    const result = validatePositioningSynthesisMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.filter((error) => error.includes("provesWrongIf")).length,
    ).toBeGreaterThanOrEqual(3);
  });
});
