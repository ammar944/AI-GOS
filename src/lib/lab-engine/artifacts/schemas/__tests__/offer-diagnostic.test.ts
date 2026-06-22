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

  it("softens co-occurring channelTruth + redFlags count-floors into honest blockGaps (degrade-commit, not hard-fail)", (): void => {
    // GOAL (b): a body with only 2 channels and 2 redFlags must commit a
    // degraded body that re-passes minimums, carrying a blockGap per
    // under-filled block — never hard-error to a .error.json.
    const twoChannels =
      offerDiagnosticFixtureArtifact.body.channelTruth.channels.slice(0, 2);
    const twoRedFlags =
      offerDiagnosticFixtureArtifact.body.redFlags.items.slice(0, 2);
    expect(twoChannels).toHaveLength(2);
    expect(twoRedFlags).toHaveLength(2);

    const body: OfferDiagnosticBody = {
      ...offerDiagnosticFixtureArtifact.body,
      channelTruth: {
        ...offerDiagnosticFixtureArtifact.body.channelTruth,
        channels: twoChannels,
      },
      redFlags: {
        ...offerDiagnosticFixtureArtifact.body.redFlags,
        items: twoRedFlags,
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

    // Re-validates clean now that both blocks carry an honest gap.
    expect(validateOfferDiagnosticMinimums(candidate).ok).toBe(true);

    // Real rows preserved on both blocks.
    expect(candidate.body.channelTruth.channels).toEqual(twoChannels);
    expect(candidate.body.redFlags.items).toEqual(twoRedFlags);

    // Each under-filled block carries an honest, schema-valid blockGap.
    const channelGap = candidate.body.channelTruth.blockGap;
    expect(channelGap?.foundCount).toBe(2);
    expect(channelGap?.requiredCount).toBe(3);
    expect(channelGap?.sourcingPlan.length).toBeGreaterThanOrEqual(1);

    const redFlagsGap = candidate.body.redFlags.blockGap;
    expect(redFlagsGap?.foundCount).toBe(2);
    expect(redFlagsGap?.requiredCount).toBe(3);
    expect(redFlagsGap?.sourcingPlan.length).toBeGreaterThanOrEqual(1);
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

// R1 deadline-exhaustion honest-gap: a heavy section's structured first attempt
// can fail with no budget left for the fallback. There is no partial to
// salvage, so run-section authors a from-scratch empty-but-honest body. This
// mirrors the exact shape buildDeadlineExhaustionHonestGapBody emits for
// OfferDiagnostic (the live-proof target) — it MUST parse offerDiagnosticBodySchema
// AND pass validateOfferDiagnosticMinimums so it commits instead of erroring.
describe("offer-diagnostic deadline-exhaustion honest-gap skeleton (R1)", (): void => {
  const note = "evidence gap: section exceeded its time budget — rerun to retry";
  const gapBlock = (requiredCount: number) => ({
    summary: note,
    foundCount: 0,
    requiredCount,
    sourcingPlan: ["Rerun this section to retry — it exceeded its time budget"],
  });
  const deadlineExhaustionBody = {
    strategicInsight: {
      strategicVerdict: note,
      keyTension: {
        tension: `${note} — no tension could be sourced in time`,
        side: `${note} — no side could be sourced in time`,
        costOfPosition: `${note} — cost of position not sourced in time`,
      },
    },
    orderedMoves: [
      {
        rank: 1,
        move: `${note} — first move not derivable until a rerun completes`,
        dependsOn: [],
        rationale: `${note} — rationale not derivable until a rerun completes`,
      },
      {
        rank: 2,
        move: `${note} — second move not derivable until a rerun completes`,
        dependsOn: [1],
        rationale: `${note} — second rationale not derivable until a rerun completes`,
      },
    ],
    provesWrongIf: { metric: note, threshold: note, window: note },
    singleBindingConstraint: {
      constraint: note,
      whyBinding: `${note} — why binding not derivable until a rerun completes`,
      unlockCondition: `${note} — unlock condition not derivable until a rerun completes`,
    },
    offerMarketFit: { prose: note, proofPoints: [], blockGap: gapBlock(3) },
    funnelDiagnosis: { prose: note, breaks: [], blockGap: gapBlock(2) },
    channelTruth: { prose: note, channels: [], blockGap: gapBlock(3) },
    retentionHealth: { prose: note, signals: [], blockGap: gapBlock(1) },
    redFlags: { prose: note, items: [], blockGap: gapBlock(3) },
  };

  it("parses bodySchema and passes validateOfferDiagnosticMinimums", (): void => {
    const candidate = artifactEnvelopeSchema
      .extend({ body: offerDiagnosticBodySchema })
      .parse({
        ...offerDiagnosticFixtureArtifact,
        verdict: note,
        statusSummary: note,
        confidence: 0.1,
        sources: Array.from({ length: 5 }, (_unused, index) => ({
          id: `deadline-gap-${index + 1}`,
          observedAt: "2026-06-01T00:00:00.000Z",
          title:
            "Placeholder — section exceeded its time budget before sources were committed",
          url: `https://saaslaunch.example.com#section-gap-${index + 1}`,
        })),
        body: deadlineExhaustionBody,
      });

    expect(validateOfferDiagnosticMinimums(candidate).ok).toBe(true);
  });
});

// Additive optional `benchmark` band on each funnelBreak. The band is
// self-policing: its sourceUrl is z.string().url() (NOT min(1)) so an unfetched
// benchmark cannot ride a non-url placeholder past the claim-extractor.
describe("offer-diagnostic benchmark field (additive)", (): void => {
  function bodyWithFirstBreak(
    overrides: Record<string, unknown>,
  ): OfferDiagnosticBody {
    const [firstBreak, ...restBreaks] =
      offerDiagnosticFixtureArtifact.body.funnelDiagnosis.breaks;
    if (firstBreak === undefined) {
      throw new Error("Expected offer diagnostic funnel break fixture.");
    }
    return {
      ...offerDiagnosticFixtureArtifact.body,
      funnelDiagnosis: {
        ...offerDiagnosticFixtureArtifact.body.funnelDiagnosis,
        breaks: [{ ...firstBreak, ...overrides }, ...restBreaks],
      },
    } as OfferDiagnosticBody;
  }

  const validBenchmark = {
    stageLabel: "Cold ad click",
    typicalRange: "1.5% - 3%",
    excellentRange: "5%+",
    sourceUrl: "https://example.com/offer/funnel-benchmark-1",
  };

  it("parses and passes minimums when a funnel break omits benchmark (back-compat)", (): void => {
    const body = offerDiagnosticFixtureArtifact.body;
    expect(() =>
      artifactEnvelopeSchema
        .extend({ body: offerDiagnosticBodySchema })
        .parse({ ...offerDiagnosticFixtureArtifact, body }),
    ).not.toThrow();
    expect(
      validateOfferDiagnosticMinimums(rebuildArtifact(body)).ok,
    ).toBe(true);
  });

  it("parses a funnel break carrying a valid benchmark band", (): void => {
    const body = bodyWithFirstBreak({ benchmark: validBenchmark });
    const candidate = artifactEnvelopeSchema
      .extend({ body: offerDiagnosticBodySchema })
      .parse({ ...offerDiagnosticFixtureArtifact, body });

    expect(candidate.body.funnelDiagnosis.breaks[0].benchmark).toEqual(
      validBenchmark,
    );
  });

  it("rejects a benchmark whose sourceUrl is a non-url placeholder", (): void => {
    const body = bodyWithFirstBreak({
      benchmark: { ...validBenchmark, sourceUrl: "not disclosed" },
    });
    const result = artifactEnvelopeSchema
      .extend({ body: offerDiagnosticBodySchema })
      .safeParse({ ...offerDiagnosticFixtureArtifact, body });

    expect(result.success).toBe(false);
  });

  it("rejects a benchmark with an unknown extra key (.strict())", (): void => {
    const body = bodyWithFirstBreak({
      benchmark: { ...validBenchmark, fabricatedExtraKey: "x" },
    });
    const result = artifactEnvelopeSchema
      .extend({ body: offerDiagnosticBodySchema })
      .safeParse({ ...offerDiagnosticFixtureArtifact, body });

    expect(result.success).toBe(false);
  });
});
