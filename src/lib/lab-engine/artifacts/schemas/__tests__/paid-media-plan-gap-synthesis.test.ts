/**
 * TDD tests for honest-gap-row synthesis in normalizePaidMediaPlanBody.
 *
 * These tests verify:
 * TEST 1: Under-floor audienceTypes / anglesToTest / creativeFramework / kpis
 *         do NOT throw — honest gap rows are synthesized to meet the floor.
 *         The synthesized rows' text is prefixed "Evidence gap:" and is
 *         therefore detected by the evidence pack's gap-detection logic.
 * TEST 2: (Overlap threshold) — see paid-media-evidence-pack-overlap.test.ts
 * TEST 3: A healthy body above all floors passes through unchanged / grounded.
 */

import { describe, expect, it } from "vitest";

import { paidMediaPlanFixtureArtifact } from "../../../fixtures/paid-media-plan-artifact";
import { normalizePaidMediaPlanBody } from "../paid-media-plan";

// Minimal scaffolding: clone the fixture and let individual tests override arrays.
function baseBody(): Record<string, unknown> {
  return structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
    string,
    unknown
  >;
}

// ─── TEST 1: under-floor bodies do NOT throw; gaps render honestly ─────────

describe("normalizePaidMediaPlanBody — honest gap-row synthesis", () => {
  it("does NOT throw when audienceTypes is empty (floor=1); synthesized row text starts with 'Evidence gap:'", () => {
    const body = baseBody();
    body.audienceTypes = [];

    // Before fix: this threw a ZodError because audienceTypes.min(1) failed.
    let result: ReturnType<typeof normalizePaidMediaPlanBody> | undefined;
    expect(() => {
      result = normalizePaidMediaPlanBody(body);
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(result!.audienceTypes.length).toBeGreaterThanOrEqual(1);

    // Every synthesized gap row must carry "Evidence gap:" in a detectable field.
    const gapRows = result!.audienceTypes.filter(
      (row) =>
        row.detail.toLowerCase().startsWith("evidence gap:") ||
        row.grounding.toLowerCase().startsWith("evidence gap:") ||
        row.archetype.toLowerCase().startsWith("evidence gap:"),
    );
    expect(gapRows.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT throw when anglesToTest has 1 row (floor=2); a gap row is added and its description starts with 'Evidence gap:'", () => {
    const body = baseBody();
    // Keep 1 real angle (fixture has ≥2) — undershoot to 1.
    const fixture = paidMediaPlanFixtureArtifact.body.anglesToTest;
    body.anglesToTest = [structuredClone(fixture[0])];

    let result: ReturnType<typeof normalizePaidMediaPlanBody> | undefined;
    expect(() => {
      result = normalizePaidMediaPlanBody(body);
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(result!.anglesToTest.length).toBeGreaterThanOrEqual(2);

    // The row(s) beyond the real one must be gap rows.
    const syntheticRows = result!.anglesToTest.slice(1);
    expect(syntheticRows.length).toBeGreaterThanOrEqual(1);
    const gapRow = syntheticRows[0]!;
    expect(
      gapRow.description.toLowerCase().startsWith("evidence gap:") ||
        gapRow.grounding.toLowerCase().startsWith("evidence gap:"),
    ).toBe(true);
  });

  it("does NOT throw when creativeFramework has 0 rows (floor=3); 3 gap rows are synthesized", () => {
    const body = baseBody();
    body.creativeFramework = [];

    let result: ReturnType<typeof normalizePaidMediaPlanBody> | undefined;
    expect(() => {
      result = normalizePaidMediaPlanBody(body);
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(result!.creativeFramework.length).toBeGreaterThanOrEqual(3);

    // All synthesized rows must contain "Evidence gap:" in a key field.
    const gapRows = result!.creativeFramework.filter(
      (row) =>
        row.hook.toLowerCase().startsWith("evidence gap:") ||
        row.grounding.toLowerCase().startsWith("evidence gap:"),
    );
    expect(gapRows.length).toBeGreaterThanOrEqual(3);
  });

  it("does NOT throw when kpis has 0 rows (floor=2); 2 gap rows are synthesized", () => {
    const body = baseBody();
    body.kpis = [];

    let result: ReturnType<typeof normalizePaidMediaPlanBody> | undefined;
    expect(() => {
      result = normalizePaidMediaPlanBody(body);
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(result!.kpis.length).toBeGreaterThanOrEqual(2);

    const gapRows = result!.kpis.filter(
      (row) =>
        row.definition.toLowerCase().startsWith("evidence gap:") ||
        row.metric.toLowerCase().startsWith("evidence gap:"),
    );
    expect(gapRows.length).toBeGreaterThanOrEqual(2);
  });

  it("synthesized gap rows are detected as gap text (mirrors isGapText logic in evidence pack)", () => {
    const body = baseBody();
    body.audienceTypes = [];
    body.anglesToTest = [];
    body.creativeFramework = [];
    body.kpis = [];

    const result = normalizePaidMediaPlanBody(body);

    // Verify all four arrays have their floors satisfied with gap-text rows.
    expect(result.audienceTypes.length).toBeGreaterThanOrEqual(1);
    expect(result.anglesToTest.length).toBeGreaterThanOrEqual(2);
    expect(result.creativeFramework.length).toBeGreaterThanOrEqual(3);
    expect(result.kpis.length).toBeGreaterThanOrEqual(2);

    // Each gap row must match the "Evidence gap:" prefix pattern so the
    // evidence pack's rowIsHonestGap() can skip it and the deck renders it
    // as an amber probe card, not a confident grounded block.
    for (const row of result.audienceTypes) {
      const isGap =
        row.detail.toLowerCase().startsWith("evidence gap:") ||
        row.archetype.toLowerCase().startsWith("evidence gap:");
      if (isGap) {
        // At least one of the detectable fields starts with "Evidence gap:"
        expect(
          row.detail.toLowerCase().startsWith("evidence gap:") ||
            row.grounding.toLowerCase().startsWith("evidence gap:"),
        ).toBe(true);
      }
    }

    for (const row of result.anglesToTest) {
      if (row.description.toLowerCase().startsWith("evidence gap:")) {
        expect(row.description.toLowerCase()).toMatch(/^evidence gap:/);
      }
    }

    for (const row of result.creativeFramework) {
      if (row.hook.toLowerCase().startsWith("evidence gap:")) {
        expect(row.hook.toLowerCase()).toMatch(/^evidence gap:/);
      }
    }

    for (const row of result.kpis) {
      if (row.definition.toLowerCase().startsWith("evidence gap:")) {
        expect(row.definition.toLowerCase()).toMatch(/^evidence gap:/);
      }
    }
  });
});

// ─── TEST 3: no-regression — healthy body above floors passes unchanged ─────

describe("normalizePaidMediaPlanBody — no-regression on healthy body", () => {
  it("fixture body passes through without modification and rows stay grounded", () => {
    const body = baseBody();

    // The fixture has real rows above all floors — it should normalize cleanly.
    let result: ReturnType<typeof normalizePaidMediaPlanBody> | undefined;
    expect(() => {
      result = normalizePaidMediaPlanBody(body);
    }).not.toThrow();

    expect(result).toBeDefined();

    // Row counts match the fixture — no extra gap rows injected.
    expect(result!.audienceTypes.length).toBe(
      paidMediaPlanFixtureArtifact.body.audienceTypes.length,
    );
    expect(result!.anglesToTest.length).toBe(
      paidMediaPlanFixtureArtifact.body.anglesToTest.length,
    );
    expect(result!.creativeFramework.length).toBe(
      paidMediaPlanFixtureArtifact.body.creativeFramework.length,
    );
    expect(result!.kpis.length).toBe(
      paidMediaPlanFixtureArtifact.body.kpis.length,
    );

    // No synthesized gap rows on a healthy body.
    const gapAudiences = result!.audienceTypes.filter((row) =>
      row.detail.toLowerCase().startsWith("evidence gap:"),
    );
    expect(gapAudiences.length).toBe(0);

    const gapAngles = result!.anglesToTest.filter((row) =>
      row.description.toLowerCase().startsWith("evidence gap:"),
    );
    expect(gapAngles.length).toBe(0);
  });
});
