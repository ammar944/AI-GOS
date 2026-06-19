import { describe, expect, it } from "vitest";

import { reconcilePersonaRealityCoverage } from "../downgrade-coverage";
import type { DowngradedRow } from "../source-liveness";

function buildBody(): Record<string, unknown> {
  return {
    personaReality: {
      personas: [
        {
          name: "Lauren Feeney",
          sourceUrl: "https://next.ramp.com/customers/perplexity",
          evidenceTier: null,
          verification: { outcome: "downgraded", reach: "uncontained" },
        },
        {
          name: "Alicia Coleman",
          sourceUrl: "https://ramp.com/customers/wizehire",
          verification: { outcome: "downgraded", reach: "uncontained" },
        },
        {
          name: "Bill Cox",
          sourceUrl: "https://ramp.com/customers/anduril",
          evidenceTier: "hard_evidence",
        },
      ],
      blockGap: {
        summary: "No influencer or gatekeeper roles surfaced.",
        foundCount: 4,
        requiredCount: 3,
        sourcingPlan: ["Analyze closed-won deal records for influencer roles"],
      },
      coverage: {
        byTier: {
          hard_evidence: 3,
          directional_signal: 0,
          strategic_inference: 0,
          operator_input: 0,
        },
        acquisitionGaps: [],
        strippedByVerifier: [],
        readiness: "adequate",
      },
    },
  };
}

const downgradedRows: DowngradedRow[] = [
  {
    path: "body.personaReality.personas[0]",
    strippedRow: {
      summary: "Lauren Feeney, Controller at Perplexity",
      originalTier: "hard_evidence",
      droppedReason: "containment-mismatch: not on live page",
      sourceUrl: "https://next.ramp.com/customers/perplexity",
    },
  },
  {
    path: "body.personaReality.personas[1]",
    strippedRow: {
      summary: "Alicia Coleman, champion at WizeHire",
      originalTier: "hard_evidence",
      droppedReason: "containment-mismatch: not on live page",
      sourceUrl: "https://ramp.com/customers/wizehire",
    },
  },
];

describe("reconcilePersonaRealityCoverage", (): void => {
  it("recounts byTier from effective tiers (downgraded rows -> directional_signal)", (): void => {
    const body = reconcilePersonaRealityCoverage({
      body: buildBody(),
      downgradedRows,
    });
    const coverage = (body.personaReality as Record<string, unknown>)
      .coverage as Record<string, unknown>;

    expect(coverage.byTier).toEqual({
      hard_evidence: 1,
      directional_signal: 2,
      strategic_inference: 0,
      operator_input: 0,
    });
  });

  it("populates strippedByVerifier from the downgraded persona rows", (): void => {
    const body = reconcilePersonaRealityCoverage({
      body: buildBody(),
      downgradedRows,
    });
    const coverage = (body.personaReality as Record<string, unknown>)
      .coverage as Record<string, unknown>;

    expect(coverage.strippedByVerifier).toEqual([
      downgradedRows[0].strippedRow,
      downgradedRows[1].strippedRow,
    ]);
  });

  it("clears the legacy blockGap when personas remain, folding it into acquisitionGaps", (): void => {
    const body = reconcilePersonaRealityCoverage({
      body: buildBody(),
      downgradedRows,
    });
    const personaReality = body.personaReality as Record<string, unknown>;
    const coverage = personaReality.coverage as Record<string, unknown>;

    expect(personaReality.blockGap).toBeUndefined();
    const gaps = coverage.acquisitionGaps as Array<Record<string, unknown>>;
    expect(gaps).toHaveLength(1);
    expect(gaps[0].whatWasSought).toContain("influencer or gatekeeper");
    expect(gaps[0].sourcingPlan).toEqual([
      "Analyze closed-won deal records for influencer roles",
    ]);
  });

  it("backfills the per-row tier on downgraded personas so rows are self-labelled", (): void => {
    const body = reconcilePersonaRealityCoverage({
      body: buildBody(),
      downgradedRows,
    });
    const personas = (
      (body.personaReality as Record<string, unknown>).personas as Array<
        Record<string, unknown>
      >
    );

    expect(personas[0].evidenceTier).toBe("directional_signal");
    expect(personas[1].evidenceTier).toBe("directional_signal");
    // The non-downgraded grounded persona keeps its authored tier.
    expect(personas[2].evidenceTier).toBe("hard_evidence");
  });

  it("reports adequate readiness when at least one hard-evidence persona remains", (): void => {
    const body = reconcilePersonaRealityCoverage({
      body: buildBody(),
      downgradedRows,
    });
    const coverage = (body.personaReality as Record<string, unknown>)
      .coverage as Record<string, unknown>;

    expect(coverage.readiness).toBe("adequate");
  });

  it("does not mutate the input body", (): void => {
    const original = buildBody();
    reconcilePersonaRealityCoverage({ body: original, downgradedRows });
    const coverage = (original.personaReality as Record<string, unknown>)
      .coverage as Record<string, unknown>;

    expect((coverage.byTier as Record<string, number>).hard_evidence).toBe(3);
    expect((original.personaReality as Record<string, unknown>).blockGap).toBeDefined();
  });

  it("creates a coverage block when personas were downgraded but coverage was absent", (): void => {
    const body = reconcilePersonaRealityCoverage({
      body: {
        personaReality: {
          personas: [
            {
              name: "Lauren Feeney",
              sourceUrl: "https://next.ramp.com/customers/perplexity",
              verification: { outcome: "downgraded", reach: "uncontained" },
            },
          ],
        },
      },
      downgradedRows: [downgradedRows[0]],
    });
    const coverage = (body.personaReality as Record<string, unknown>)
      .coverage as Record<string, unknown>;

    expect(coverage).toBeDefined();
    expect(coverage.byTier).toEqual({
      hard_evidence: 0,
      directional_signal: 1,
      strategic_inference: 0,
      operator_input: 0,
    });
    expect(coverage.strippedByVerifier).toEqual([downgradedRows[0].strippedRow]);
  });

  it("leaves a body without any personaReality untouched", (): void => {
    const body = reconcilePersonaRealityCoverage({
      body: { keyFindings: { findings: [] } },
      downgradedRows: [],
    });

    expect((body as Record<string, unknown>).personaReality).toBeUndefined();
  });
});
