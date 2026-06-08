import { describe, expect, it } from "vitest";

import { crossSectionReasoningFixtureArtifact } from "../../../fixtures/cross-section-reasoning-artifact";
import {
  crossSectionReasoningSectionOutputSchema,
  validateCrossSectionReasoningMinimums,
  type CrossSectionReasoningArtifact,
} from "../cross-section-reasoning";

function cloneFixture(): CrossSectionReasoningArtifact {
  return structuredClone(crossSectionReasoningFixtureArtifact);
}

describe("crossSectionReasoningSectionOutputSchema", (): void => {
  it("parses the fixture body shape as a section output", (): void => {
    const {
      id: _id,
      runId: _runId,
      sectionId: _sectionId,
      createdAt: _createdAt,
      ...output
    } = crossSectionReasoningFixtureArtifact;
    void _id;
    void _runId;
    void _sectionId;
    void _createdAt;

    const result = crossSectionReasoningSectionOutputSchema.safeParse({
      ...output,
      sources: output.sources.map((source) => ({
        title: source.title,
        url: source.url,
      })),
    });

    expect(result.success).toBe(true);
  });

  it("accepts a source with a null publisher and coerces it to undefined", (): void => {
    // Live E2E 2026-06-08: the flash model emits `publisher: null` for sources
    // without a clear publisher. The thinker aggregates sources from all six
    // sections, so it hit 10 nulls -> attempt-1 validation failed -> repair loop
    // -> 270s job timeout -> capstone chain never dispatched. `.optional()`
    // rejected null; the schema must treat null as absent.
    const {
      id: _id,
      runId: _runId,
      sectionId: _sectionId,
      createdAt: _createdAt,
      ...output
    } = crossSectionReasoningFixtureArtifact;
    void _id;
    void _runId;
    void _sectionId;
    void _createdAt;

    const result = crossSectionReasoningSectionOutputSchema.safeParse({
      ...output,
      sources: output.sources.map((source) => ({
        title: source.title,
        url: source.url,
        publisher: null,
      })),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      for (const source of result.data.sources) {
        expect(source.publisher).toBeUndefined();
      }
    }
  });
});

describe("validateCrossSectionReasoningMinimums", (): void => {
  it("accepts the valid fixture", (): void => {
    expect(validateCrossSectionReasoningMinimums(cloneFixture())).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects missing cross-section threads", (): void => {
    const artifact = cloneFixture();
    artifact.body.crossSectionThreads = [];

    const result = validateCrossSectionReasoningMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("crossSectionThreads"))).toBe(
      true,
    );
  });

  it("rejects a thread with fewer than two distinct source sections", (): void => {
    const artifact = cloneFixture();
    const [firstRef] = artifact.body.crossSectionThreads[0].sourceSections;
    artifact.body.crossSectionThreads[0].sourceSections = [
      firstRef,
      { ...firstRef, sourceUrl: "https://example.com/duplicate-source" },
    ];

    const result = validateCrossSectionReasoningMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes("sourceSections: need >=2 distinct"),
      ),
    ).toBe(true);
  });

  it("rejects generic cross-section filler", (): void => {
    const artifact = cloneFixture();
    artifact.body.crossSectionThreads[0].claim =
      "This section summarizes the current market and competitor information.";

    const result = validateCrossSectionReasoningMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("summary"))).toBe(true);
  });

  it("throws when envelope confidence is outside the allowed range", (): void => {
    const artifact = cloneFixture();
    artifact.confidence = 1.2;

    expect(() => validateCrossSectionReasoningMinimums(artifact)).toThrow(
      /confidence/i,
    );
  });

  it("rejects artifacts that cover fewer than four committed sections", (): void => {
    const artifact = cloneFixture();
    const twoRefs = artifact.body.crossSectionThreads[0].sourceSections.slice(0, 2);
    artifact.body.crossSectionThreads = artifact.body.crossSectionThreads.map(
      (thread) => ({ ...thread, sourceSections: twoRefs }),
    );
    artifact.body.clientBlindSpot.sourceSections = twoRefs;
    artifact.body.namedTension.sourceSections = twoRefs;
    artifact.body.secondOrderRisk.sourceSections = twoRefs;
    artifact.body.contrarianInversion.sourceSections = twoRefs;

    const result = validateCrossSectionReasoningMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("at least four"))).toBe(
      true,
    );
  });
});
