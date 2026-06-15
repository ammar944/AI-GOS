import { describe, expect, it } from "vitest";

import { offerDiagnosticFixtureArtifact } from "../../../fixtures/offer-diagnostic-artifact";
import {
  artifactEnvelopeSchema,
} from "../../artifact-envelope";
import {
  buildOfferDiagnosticBlockGapBody,
  buildOfferDiagnosticEvidenceGapBody,
  offerDiagnosticBodySchema,
  parseOfferDiagnosticStrategicEvidenceGapPath,
  validateOfferDiagnosticMinimums,
  type OfferDiagnosticArtifact,
  type OfferDiagnosticBody,
} from "../offer-diagnostic";

// A short vacuous restatement that fails validateStrategicText (matches the
// "improve messaging" vacuous pattern, length >= 32) — this is the exact
// stochastic OfferDiagnostic failure shape (orderedMoves "restatement").
const VACUOUS_TEXT =
  "Improve messaging and clarify positioning for the company.";

function rebuildArtifact(
  body: OfferDiagnosticBody,
): OfferDiagnosticArtifact {
  return {
    ...offerDiagnosticFixtureArtifact,
    body,
  } as OfferDiagnosticArtifact;
}

function patchAndRevalidate(
  body: OfferDiagnosticBody,
): { ok: boolean; patched: OfferDiagnosticBody | null } {
  const failing = rebuildArtifact(body);
  const minimums = validateOfferDiagnosticMinimums(failing);
  expect(minimums.ok).toBe(false);

  const patchedBody = buildOfferDiagnosticEvidenceGapBody({
    body: failing.body as unknown as Record<string, unknown>,
    errors: minimums.errors,
  });

  if (patchedBody === null) {
    return { ok: false, patched: null };
  }

  const candidate = artifactEnvelopeSchema
    .extend({ body: offerDiagnosticBodySchema })
    .parse({ ...offerDiagnosticFixtureArtifact, body: patchedBody });

  return { ok: validateOfferDiagnosticMinimums(candidate).ok, patched: candidate.body };
}

describe("offer-diagnostic evidence-gap escape hatch (T2b)", (): void => {
  it("fixture passes minimums (control)", (): void => {
    expect(
      validateOfferDiagnosticMinimums(offerDiagnosticFixtureArtifact).ok,
    ).toBe(true);
  });

  it("softens a restated orderedMoves[i].move and re-passes minimums", (): void => {
    const moves = offerDiagnosticFixtureArtifact.body.orderedMoves.map(
      (move, index) =>
        index === 0 ? { ...move, move: VACUOUS_TEXT } : move,
    );
    const { ok, patched } = patchAndRevalidate({
      ...offerDiagnosticFixtureArtifact.body,
      orderedMoves: moves,
    });

    expect(ok).toBe(true);
    expect(patched?.orderedMoves[0].move.startsWith("evidence gap:")).toBe(true);
    // Untouched move is preserved.
    expect(patched?.orderedMoves[1].move).toBe(
      offerDiagnosticFixtureArtifact.body.orderedMoves[1].move,
    );
  });

  it("softens a restated singleBindingConstraint field and re-passes minimums", (): void => {
    const { ok, patched } = patchAndRevalidate({
      ...offerDiagnosticFixtureArtifact.body,
      singleBindingConstraint: {
        ...offerDiagnosticFixtureArtifact.body.singleBindingConstraint,
        constraint: VACUOUS_TEXT,
      },
    });

    expect(ok).toBe(true);
    expect(
      patched?.singleBindingConstraint.constraint.startsWith("evidence gap:"),
    ).toBe(true);
  });

  it("softens a restated strategicInsight field and re-passes minimums", (): void => {
    const { ok, patched } = patchAndRevalidate({
      ...offerDiagnosticFixtureArtifact.body,
      strategicInsight: {
        ...offerDiagnosticFixtureArtifact.body.strategicInsight,
        nonObviousRead: VACUOUS_TEXT,
      },
    });

    expect(ok).toBe(true);
    expect(
      patched?.strategicInsight.nonObviousRead?.startsWith("evidence gap:"),
    ).toBe(true);
  });

  it("softens a non-falsifiable provesWrongIf field and re-passes minimums", (): void => {
    const { ok, patched } = patchAndRevalidate({
      ...offerDiagnosticFixtureArtifact.body,
      provesWrongIf: {
        ...offerDiagnosticFixtureArtifact.body.provesWrongIf,
        metric: "unknown",
      },
    });

    expect(ok).toBe(true);
    expect(patched?.provesWrongIf.metric.startsWith("evidence gap:")).toBe(true);
  });

  it("returns null (hard-fail) for a structural failure outside the allowlist", (): void => {
    // Too few proof points is structural — a gap string cannot fix it, so the
    // builder must decline and let the section hard-fail.
    const body: OfferDiagnosticBody = {
      ...offerDiagnosticFixtureArtifact.body,
      offerMarketFit: {
        ...offerDiagnosticFixtureArtifact.body.offerMarketFit,
        proofPoints: [
          offerDiagnosticFixtureArtifact.body.offerMarketFit.proofPoints[0],
        ],
      },
    };
    const failing = rebuildArtifact(body);
    const minimums = validateOfferDiagnosticMinimums(failing);
    expect(minimums.ok).toBe(false);

    expect(
      buildOfferDiagnosticEvidenceGapBody({
        body: failing.body as unknown as Record<string, unknown>,
        errors: minimums.errors,
      }),
    ).toBeNull();
  });

  it("accepts one retention signal instead of forcing retention diversity", (): void => {
    const firstSignal = offerDiagnosticFixtureArtifact.body.retentionHealth.signals[0];

    if (firstSignal === undefined) {
      throw new Error("Expected offer diagnostic retention fixture signal.");
    }

    const body: OfferDiagnosticBody = {
      ...offerDiagnosticFixtureArtifact.body,
      retentionHealth: {
        ...offerDiagnosticFixtureArtifact.body.retentionHealth,
        signals: [firstSignal],
      },
    };

    expect(validateOfferDiagnosticMinimums(rebuildArtifact(body)).ok).toBe(true);
  });

  it("accepts a retentionHealth blockGap when no retention signal is evidenced", (): void => {
    const body: OfferDiagnosticBody = {
      ...offerDiagnosticFixtureArtifact.body,
      retentionHealth: {
        ...offerDiagnosticFixtureArtifact.body.retentionHealth,
        signals: [],
        blockGap: {
          summary: "No public retention signal was retrieved.",
          foundCount: 0,
          requiredCount: 1,
          sourcingPlan: ["Check onboarding analytics and customer proof assets."],
        },
      },
    };

    expect(validateOfferDiagnosticMinimums(rebuildArtifact(body)).ok).toBe(true);
  });
});

describe("offer-diagnostic structural blockGap escape hatch (T2c)", (): void => {
  it("softens a too-few-proofPoints floor into a schema-valid offerMarketFit blockGap, retaining real rows", (): void => {
    const realProofPoints =
      offerDiagnosticFixtureArtifact.body.offerMarketFit.proofPoints.slice(0, 2);
    expect(realProofPoints).toHaveLength(2);

    const body: OfferDiagnosticBody = {
      ...offerDiagnosticFixtureArtifact.body,
      offerMarketFit: {
        ...offerDiagnosticFixtureArtifact.body.offerMarketFit,
        proofPoints: realProofPoints,
      },
    };

    const failing = rebuildArtifact(body);
    const minimums = validateOfferDiagnosticMinimums(failing);
    expect(minimums.ok).toBe(false);

    const patchedBody = buildOfferDiagnosticBlockGapBody({
      body: failing.body as unknown as Record<string, unknown>,
      errors: minimums.errors,
    });
    expect(patchedBody).not.toBeNull();

    const candidate = artifactEnvelopeSchema
      .extend({ body: offerDiagnosticBodySchema })
      .parse({ ...offerDiagnosticFixtureArtifact, body: patchedBody });

    // Re-validates clean now that the block carries an honest gap.
    expect(validateOfferDiagnosticMinimums(candidate).ok).toBe(true);

    // Real rows preserved (not blanked).
    expect(candidate.body.offerMarketFit.proofPoints).toEqual(realProofPoints);

    // blockGap present and schema-valid (survived the field transform).
    const blockGap = candidate.body.offerMarketFit.blockGap;
    expect(blockGap).toBeDefined();
    expect(blockGap?.foundCount).toBe(2);
    expect(blockGap?.requiredCount).toBe(3);
    expect(blockGap?.summary.length).toBeGreaterThan(0);
    expect(blockGap?.sourcingPlan.length).toBeGreaterThanOrEqual(1);
  });

  it("returns null for an unrecognized error so unknown failures still hard-fail", (): void => {
    expect(
      buildOfferDiagnosticBlockGapBody({
        body: offerDiagnosticFixtureArtifact.body as unknown as Record<
          string,
          unknown
        >,
        errors: ["body.somethingElse: this is not a known structural floor."],
      }),
    ).toBeNull();
  });
});

describe("parseOfferDiagnosticStrategicEvidenceGapPath", (): void => {
  it("extracts an allowlisted strategic-text path", (): void => {
    expect(
      parseOfferDiagnosticStrategicEvidenceGapPath(
        'body.singleBindingConstraint.constraint: must be a specific strategic judgment or write exactly `evidence gap: <missing signal>`, not a summary/restatement. Do not satisfy "specific" with numbers that are not in fetched evidence - unsupported numeric precision is treated as fabrication.',
      ),
    ).toBe("body.singleBindingConstraint.constraint");
  });

  it("extracts an allowlisted falsifiability path", (): void => {
    expect(
      parseOfferDiagnosticStrategicEvidenceGapPath(
        "body.provesWrongIf.window: must be a concrete falsifiability window or explicit evidence gap.",
      ),
    ).toBe("body.provesWrongIf.window");
  });

  it("extracts an orderedMoves array path", (): void => {
    expect(
      parseOfferDiagnosticStrategicEvidenceGapPath(
        'body.orderedMoves[1].rationale: must be a specific strategic judgment or write exactly `evidence gap: <missing signal>`, not a summary/restatement. Do not satisfy "specific" with numbers that are not in fetched evidence - unsupported numeric precision is treated as fabrication.',
      ),
    ).toBe("body.orderedMoves[1].rationale");
  });

  it("returns null for a non-softenable structural error", (): void => {
    expect(
      parseOfferDiagnosticStrategicEvidenceGapPath(
        "body.offerMarketFit.proofPoints: have 1, need >=3.",
      ),
    ).toBeNull();
  });
});
