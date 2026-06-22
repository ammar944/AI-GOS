import { describe, expect, it } from "vitest";

import {
  buildCompetitorStrategicEvidenceGapArtifact,
  buildDemandIntentEvidenceGapArtifact,
  buildMarketCategoryEvidenceGapArtifact,
  redegradeIfCountFloorRegressed,
  type RunSectionInput,
} from "../run-section";
import type { ArtifactEnvelope } from "../../artifacts/artifact-envelope";
import { competitorLandscapeFixtureArtifact } from "../../fixtures/competitor-landscape-artifact";
import { demandIntentFixtureArtifact } from "../../fixtures/demand-intent-artifact";
import { marketCategoryFixtureArtifact } from "../../fixtures/market-category-artifact";
import { offerDiagnosticFixtureArtifact } from "../../fixtures/offer-diagnostic-artifact";
import { saaslaunchResearchInput } from "../../fixtures/saaslaunch";
import { getSection } from "../../sections/section-registry";

// The internal RuntimeSectionDefinition interface is a structural subset of a
// registry section, so the real section IS a valid definition for these builders.
type GapBuilderDefinition = Parameters<
  typeof buildMarketCategoryEvidenceGapArtifact
>[0]["definition"];

function asDefinition(sectionId: Parameters<typeof getSection>[0]): GapBuilderDefinition {
  return getSection(sectionId) as unknown as GapBuilderDefinition;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe("buildMarketCategoryEvidenceGapArtifact (tolerant-out R1)", (): void => {
  const definition = asDefinition("positioningMarketCategory");
  const input: RunSectionInput = {
    runId: "run-market-gap",
    sectionId: "positioningMarketCategory",
  };

  it("commits a degraded artifact (not undefined) and re-passes minimums when structural floors + categoryPowerBet + sources fail", (): void => {
    const broken = clone(marketCategoryFixtureArtifact) as ArtifactEnvelope;
    const body = broken.body as Record<string, unknown>;

    // Hollow out the structural blocks (these have blockGap escapes).
    (body.categoryDefinition as Record<string, unknown>).adjacentCategories = [];
    (body.marketSize as Record<string, unknown>).signals = [];
    (body.structuralForces as Record<string, unknown>).forces = [];
    (
      (body.categoryMaturity as Record<string, unknown>)
        .classification as Record<string, unknown>
    ).supportingSignals = [];
    // Make categoryPowerBet non-strategic (vacuous restatement of the verdict).
    body.categoryPowerBet = {
      bet: "n/a",
      whyNow: "n/a",
      riskAccepted: "n/a",
    };
    // Drop sources below the >=3 floor.
    broken.sources = broken.sources.slice(0, 1);

    const verdict = definition.validateMinimums(
      broken as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(verdict.ok).toBe(false);

    const degraded = buildMarketCategoryEvidenceGapArtifact({
      artifact: broken,
      definition,
      errors: verdict.errors,
      input,
      researchInput: saaslaunchResearchInput,
    });

    expect(degraded).toBeDefined();
    expect(degraded?.confidence).toBeLessThanOrEqual(0.3);
    // Sources were backfilled from the research input to clear the >=3 floor.
    expect((degraded?.sources.length ?? 0)).toBeGreaterThanOrEqual(3);
    const recheck = definition.validateMinimums(
      degraded as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(recheck.ok).toBe(true);
  });

  it("returns undefined for a non-market section (sectionId guard)", (): void => {
    expect(
      buildMarketCategoryEvidenceGapArtifact({
        artifact: clone(marketCategoryFixtureArtifact) as ArtifactEnvelope,
        definition,
        errors: ["sources: have 1, need >=3 Section-level sources."],
        input: { runId: "x", sectionId: "positioningBuyerICP" },
        researchInput: saaslaunchResearchInput,
      }),
    ).toBeUndefined();
  });

  // GOAL (a): a body with only 1 adjacentCategory commits with a
  // categoryDefinition blockGap (NOT undefined / .error.json), confidence
  // lowered to reflect the gap, and re-passes minimums.
  it("degrades a lone adjacentCategories=1 count-floor into a categoryDefinition blockGap", (): void => {
    const broken = clone(marketCategoryFixtureArtifact) as ArtifactEnvelope;
    const body = broken.body as Record<string, unknown>;
    const categoryDefinition = body.categoryDefinition as Record<string, unknown>;
    categoryDefinition.adjacentCategories = (
      categoryDefinition.adjacentCategories as unknown[]
    ).slice(0, 1);

    const verdict = definition.validateMinimums(
      broken as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(verdict.ok).toBe(false);
    expect(
      verdict.errors.some((error) =>
        error.startsWith("body.categoryDefinition.adjacentCategories: have 1"),
      ),
    ).toBe(true);

    const degraded = buildMarketCategoryEvidenceGapArtifact({
      artifact: broken,
      definition,
      errors: verdict.errors,
      input,
      researchInput: saaslaunchResearchInput,
    });

    expect(degraded).toBeDefined();
    expect(degraded?.confidence).toBeLessThanOrEqual(0.3);
    const gapBody = degraded?.body as Record<string, unknown>;
    const gappedCategoryDefinition = gapBody.categoryDefinition as Record<
      string,
      unknown
    >;
    expect(gappedCategoryDefinition.blockGap).toBeDefined();
    expect(
      definition.validateMinimums(
        degraded as ArtifactEnvelope & { body: Record<string, unknown> },
      ).ok,
    ).toBe(true);
  });

  // WAVE 0.5 fix: a count-floor co-occurring with the bottom-up TAM caveats
  // count-floor (`caveats: have 0, need >=1`) used to bail the builder to
  // undefined -> the whole section hard-failed to a .error.json. The caveats
  // floor is itself a too-few-rows floor and must degrade via the marketSize
  // blockGap rather than take the degradable adjacentCategories floor down with
  // it.
  it("degrades a count-floor that co-occurs with the bottom-up TAM caveats count-floor (previously a hard-fail bail)", (): void => {
    const broken = clone(marketCategoryFixtureArtifact) as ArtifactEnvelope;
    const body = broken.body as Record<string, unknown>;
    const categoryDefinition = body.categoryDefinition as Record<string, unknown>;
    categoryDefinition.adjacentCategories = (
      categoryDefinition.adjacentCategories as unknown[]
    ).slice(0, 1);
    (
      (body.marketSize as Record<string, unknown>).bottomUpTam as Record<
        string,
        unknown
      >
    ).caveats = [];

    const verdict = definition.validateMinimums(
      broken as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(verdict.ok).toBe(false);
    expect(
      verdict.errors.some((error) =>
        error.startsWith("body.marketSize.bottomUpTam.caveats: have 0"),
      ),
    ).toBe(true);

    const degraded = buildMarketCategoryEvidenceGapArtifact({
      artifact: broken,
      definition,
      errors: verdict.errors,
      input,
      researchInput: saaslaunchResearchInput,
    });

    expect(degraded).toBeDefined();
    expect(degraded?.confidence).toBeLessThanOrEqual(0.3);
    expect(
      definition.validateMinimums(
        degraded as ArtifactEnvelope & { body: Record<string, unknown> },
      ).ok,
    ).toBe(true);
  });

  // FIREWALL: a count-floor co-occurring with a NON-count integrity check
  // (duplicate signalType — a truth/shape check, not a row count) must STILL
  // hard-fail (builder returns undefined). The degrade path must never launder
  // a non-count failure into a committed body.
  it("still hard-fails (undefined) when a count-floor co-occurs with a duplicate-signalType integrity failure", (): void => {
    const broken = clone(marketCategoryFixtureArtifact) as ArtifactEnvelope;
    const body = broken.body as Record<string, unknown>;
    const categoryDefinition = body.categoryDefinition as Record<string, unknown>;
    categoryDefinition.adjacentCategories = (
      categoryDefinition.adjacentCategories as unknown[]
    ).slice(0, 1);
    const signals = (body.marketSize as Record<string, unknown>).signals as Array<
      Record<string, unknown>
    >;
    expect(signals.length).toBeGreaterThanOrEqual(2);
    signals[1].signalType = signals[0].signalType;

    const verdict = definition.validateMinimums(
      broken as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(verdict.ok).toBe(false);
    expect(
      verdict.errors.some((error) =>
        error.includes("duplicate signalType"),
      ),
    ).toBe(true);

    expect(
      buildMarketCategoryEvidenceGapArtifact({
        artifact: broken,
        definition,
        errors: verdict.errors,
        input,
        researchInput: saaslaunchResearchInput,
      }),
    ).toBeUndefined();
  });

  // GOAL (d): a body that meets every floor must NOT get a spurious blockGap —
  // the builder only runs on a real minimums failure, and a clean fixture has
  // no errors to degrade.
  it("returns undefined (no spurious gap) when the artifact already meets every floor", (): void => {
    const clean = clone(marketCategoryFixtureArtifact) as ArtifactEnvelope;
    const verdict = definition.validateMinimums(
      clean as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(verdict.ok).toBe(true);

    expect(
      buildMarketCategoryEvidenceGapArtifact({
        artifact: clean,
        definition,
        errors: verdict.errors,
        input,
        researchInput: saaslaunchResearchInput,
      }),
    ).toBeUndefined();
  });
});

describe("buildDemandIntentEvidenceGapArtifact (tolerant-out R1)", (): void => {
  const definition = asDefinition("positioningDemandIntent");
  const deps = { store: {} as never, loadSkill: async () => "" };
  const input: RunSectionInput = {
    runId: "run-demand-gap",
    sectionId: "positioningDemandIntent",
  };

  it("commits the honest deadline-shaped degraded body and re-passes minimums", (): void => {
    const broken = clone(demandIntentFixtureArtifact) as ArtifactEnvelope;
    // Simulate a section whose own body cannot pass (and too few sources).
    broken.sources = broken.sources.slice(0, 1);

    const degraded = buildDemandIntentEvidenceGapArtifact({
      artifact: broken,
      definition,
      deps,
      input,
      researchInput: saaslaunchResearchInput,
    });

    expect(degraded).toBeDefined();
    expect(degraded?.confidence).toBeLessThanOrEqual(0.3);
    expect((degraded?.sources.length ?? 0)).toBeGreaterThanOrEqual(5);
    const recheck = definition.validateMinimums(
      degraded as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(recheck.ok).toBe(true);
  });

  it("returns undefined for a non-demand section (sectionId guard)", (): void => {
    expect(
      buildDemandIntentEvidenceGapArtifact({
        artifact: clone(demandIntentFixtureArtifact) as ArtifactEnvelope,
        definition,
        deps,
        input: { runId: "x", sectionId: "positioningMarketCategory" },
        researchInput: saaslaunchResearchInput,
      }),
    ).toBeUndefined();
  });
});

describe("buildCompetitorStrategicEvidenceGapArtifact structural blockGap injector (Fix 3)", (): void => {
  const definition = asDefinition("positioningCompetitorLandscape");
  const input: RunSectionInput = {
    runId: "run-competitor-gap",
    sectionId: "positioningCompetitorLandscape",
  };

  it("injects structural blockGaps and re-passes minimums when count floors fail (previously hard-failed via the path===null early-bail)", (): void => {
    const broken = clone(competitorLandscapeFixtureArtifact) as ArtifactEnvelope;
    const body = broken.body as Record<string, unknown>;

    // Hollow out structural blocks — count floors with blockGap escapes.
    (body.competitorSet as Record<string, unknown>).competitors = [];
    (body.positioningTaxonomy as Record<string, unknown>).axes = [];
    (body.pricingReality as Record<string, unknown>).dataPoints = [];
    (body.shareOfVoice as Record<string, unknown>).slices = [];
    (body.publicWeaknesses as Record<string, unknown>).items = [];
    (body.narrativeArcs as Record<string, unknown>).arcs = [];

    const verdict = definition.validateMinimums(
      broken as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(verdict.ok).toBe(false);

    const degraded = buildCompetitorStrategicEvidenceGapArtifact({
      artifact: broken,
      definition,
      errors: verdict.errors,
      input,
    });

    expect(degraded).toBeDefined();
    expect(degraded?.confidence).toBeLessThanOrEqual(0.3);
    const recheck = definition.validateMinimums(
      degraded as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(recheck.ok).toBe(true);
  });

  it("waives the section-level sources floor once a structural blockGap is injected", (): void => {
    const broken = clone(competitorLandscapeFixtureArtifact) as ArtifactEnvelope;
    const body = broken.body as Record<string, unknown>;
    (body.competitorSet as Record<string, unknown>).competitors = [];
    // Drop sources below the >=5 floor too — the gate is now body-level gated.
    broken.sources = broken.sources.slice(0, 2);

    const verdict = definition.validateMinimums(
      broken as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(verdict.ok).toBe(false);
    expect(
      verdict.errors.some((error) => error.startsWith("sources: have")),
    ).toBe(true);

    const degraded = buildCompetitorStrategicEvidenceGapArtifact({
      artifact: broken,
      definition,
      errors: verdict.errors,
      input,
    });

    expect(degraded).toBeDefined();
    expect(
      definition.validateMinimums(
        degraded as ArtifactEnvelope & { body: Record<string, unknown> },
      ).ok,
    ).toBe(true);
  });
});

// Save-time count-floor regression repair: a sourceUrl-bearing row dropped by
// the post-gate evidence-strip chain inside annotateEvidenceSupportReview can
// pull a count-floored block below threshold AFTER the committable gate already
// passed it. redegradeIfCountFloorRegressed re-runs the SAME validateMinimums
// the gate used and routes a recognized count-floor regression back through the
// section's existing gap builder so the body commits with a blockGap instead of
// hard-failing at assertSectionArtifactPersistable -> section ABSENT.
describe("redegradeIfCountFloorRegressed (save-time count-floor repair)", (): void => {
  const definition = asDefinition("positioningOfferDiagnostic");
  const input: RunSectionInput = {
    runId: "run-offer-redegrade",
    sectionId: "positioningOfferDiagnostic",
  };

  it("(a) re-degrades an Offer body whose funnelDiagnosis.breaks regressed to 1 — commits with a funnelDiagnosis.blockGap, NOT .error.json", (): void => {
    const regressed = clone(offerDiagnosticFixtureArtifact) as ArtifactEnvelope;
    const body = regressed.body as Record<string, unknown>;
    const funnel = body.funnelDiagnosis as Record<string, unknown>;
    // Mirror the live evidence-strip: one of the two breaks rows is dropped
    // (its sourceUrl graded uncontained), so the count floor regresses 2 -> 1.
    funnel.breaks = (funnel.breaks as unknown[]).slice(0, 1);

    // Precondition: this body would hard-fail the save-time assertion as-is.
    const before = definition.validateMinimums(
      regressed as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(before.ok).toBe(false);
    expect(before.errors).toContain(
      "body.funnelDiagnosis.breaks: have 1, need >=2.",
    );

    const repaired = redegradeIfCountFloorRegressed({
      artifact: regressed,
      definition,
      input,
      researchInput: saaslaunchResearchInput,
    });

    // The repaired body now passes the IDENTICAL validateMinimums the save-time
    // assertion runs — so assertSectionArtifactPersistable would NOT throw.
    expect(
      definition.validateMinimums(
        repaired as ArtifactEnvelope & { body: Record<string, unknown> },
      ).ok,
    ).toBe(true);

    // The under-filled block carries an honest blockGap (degraded commit), not
    // the runner-draft rows pretending to satisfy the floor.
    const repairedFunnel = (repaired.body as Record<string, unknown>)
      .funnelDiagnosis as Record<string, unknown>;
    expect(repairedFunnel.blockGap).toBeDefined();

    // Confidence is lowered honestly so the section reads as needs_review.
    expect(repaired.confidence).toBeLessThanOrEqual(0.3);
  });

  it("(b) leaves a NON-count save-assertion failure hard-failing — the section's gap builder cannot blockGap an unrecognized minimum, so the artifact is returned unchanged", (): void => {
    const regressed = clone(offerDiagnosticFixtureArtifact) as ArtifactEnvelope;
    // Drop section sources below the >=5 floor. The Offer gap builder does NOT
    // recognize the sources floor (no blockGap escape) -> returns undefined ->
    // the helper preserves the current hard-fail behavior.
    regressed.sources = regressed.sources.slice(0, 1);

    const before = definition.validateMinimums(
      regressed as ArtifactEnvelope & { body: Record<string, unknown> },
    );
    expect(before.ok).toBe(false);
    expect(
      before.errors.some((error) => error.startsWith("sources: have ")),
    ).toBe(true);

    const result = redegradeIfCountFloorRegressed({
      artifact: regressed,
      definition,
      input,
      researchInput: saaslaunchResearchInput,
    });

    // Returned unchanged: still fails minimums, so the save-time assertion
    // still throws exactly as it does today (truth firewall preserved).
    expect(result).toBe(regressed);
    expect(
      definition.validateMinimums(
        result as ArtifactEnvelope & { body: Record<string, unknown> },
      ).ok,
    ).toBe(false);
  });

  it("(c) leaves a healthy body untouched — no spurious re-degrade, identity returned", (): void => {
    const healthy = clone(offerDiagnosticFixtureArtifact) as ArtifactEnvelope;

    // Sanity: the fixture commits cleanly.
    expect(
      definition.validateMinimums(
        healthy as ArtifactEnvelope & { body: Record<string, unknown> },
      ).ok,
    ).toBe(true);

    const result = redegradeIfCountFloorRegressed({
      artifact: healthy,
      definition,
      input,
      researchInput: saaslaunchResearchInput,
    });

    // Same reference back: no blockGap injected, no confidence change.
    expect(result).toBe(healthy);
    expect(
      (
        (result.body as Record<string, unknown>).funnelDiagnosis as Record<
          string,
          unknown
        >
      ).blockGap,
    ).toBeUndefined();
    expect(result.confidence).toBe(offerDiagnosticFixtureArtifact.confidence);
  });
});
