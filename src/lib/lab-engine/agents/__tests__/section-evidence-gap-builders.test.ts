import { describe, expect, it } from "vitest";

import {
  buildCompetitorStrategicEvidenceGapArtifact,
  buildDemandIntentEvidenceGapArtifact,
  buildMarketCategoryEvidenceGapArtifact,
  type RunSectionInput,
} from "../run-section";
import type { ArtifactEnvelope } from "../../artifacts/artifact-envelope";
import { competitorLandscapeFixtureArtifact } from "../../fixtures/competitor-landscape-artifact";
import { demandIntentFixtureArtifact } from "../../fixtures/demand-intent-artifact";
import { marketCategoryFixtureArtifact } from "../../fixtures/market-category-artifact";
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
