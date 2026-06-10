import { describe, expect, it } from "vitest";
import { z } from "zod";

import { paidMediaPlanFixtureArtifact } from "../../../fixtures/paid-media-plan-artifact";
import {
  normalizePaidMediaPlanBody,
  paidMediaMoneyProvenanceValues,
  paidMediaPlanBodySchema,
  paidMediaPlanSectionOutputSchema,
  snapSourceSection,
  validatePaidMediaPlanMinimums,
  type PaidMediaPlanArtifact,
} from "../paid-media-plan";

function buildPaidMediaPlanOutput(): Record<string, unknown> {
  return {
    sectionTitle: paidMediaPlanFixtureArtifact.sectionTitle,
    verdict: paidMediaPlanFixtureArtifact.verdict,
    statusSummary: paidMediaPlanFixtureArtifact.statusSummary,
    confidence: paidMediaPlanFixtureArtifact.confidence,
    sources: paidMediaPlanFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    body: structuredClone(paidMediaPlanFixtureArtifact.body),
  };
}

function cloneFixture(): PaidMediaPlanArtifact {
  return structuredClone(paidMediaPlanFixtureArtifact);
}

describe("snapSourceSection", () => {
  it("snaps common aliases to canonical source sections", () => {
    expect(snapSourceSection("positioningVoC")).toBe("positioningVoiceOfCustomer");
    expect(snapSourceSection("buyer-icp")).toBe("positioningBuyerICP");
    expect(snapSourceSection("offer diagnostic")).toBe(
      "positioningOfferDiagnostic",
    );
  });

  it("snaps unknown legacy sources to the GTM brief fallback", () => {
    expect(snapSourceSection("legacy-thinker")).toBe("gtmBrief");
  });
});

describe("paidMediaPlanSectionOutputSchema", () => {
  it("accepts the lean paid-media output fixture", () => {
    const parsed = paidMediaPlanSectionOutputSchema.safeParse(
      buildPaidMediaPlanOutput(),
    );

    expect(parsed.success).toBe(true);
  });

  it("strips unknown body keys instead of failing the commit path", () => {
    const output = buildPaidMediaPlanOutput();
    const body = output.body as Record<string, unknown>;
    const campaignOverview = body.campaignOverview as Record<string, unknown>;

    body.strategicThesis = { stale: true };
    body.orderedMoves = { stale: true };
    campaignOverview.unexpected = "strip me";

    const parsed = paidMediaPlanSectionOutputSchema.parse(output);
    const parsedBody = parsed.body as Record<string, unknown>;
    const parsedCampaignOverview = parsedBody.campaignOverview as Record<
      string,
      unknown
    >;

    expect(parsedBody).not.toHaveProperty("strategicThesis");
    expect(parsedBody).not.toHaveProperty("orderedMoves");
    expect(parsedCampaignOverview).not.toHaveProperty("unexpected");
  });

  it("keeps money provenance as free strings while documenting snap targets", () => {
    const provenanceSchema = z.enum(paidMediaMoneyProvenanceValues);

    expect(
      paidMediaMoneyProvenanceValues.map((value) =>
        provenanceSchema.parse(value),
      ),
    ).toEqual([
      "user-supplied",
      "tool-measured",
      "source-reported",
      "model-estimated",
      "unknown",
    ]);

    const output = buildPaidMediaPlanOutput();
    const body = output.body as Record<string, unknown>;
    const overview = body.campaignOverview as Record<string, unknown>;
    overview.monthlyBudgetProvenance = "client-note";

    expect(paidMediaPlanSectionOutputSchema.safeParse(output).success).toBe(
      true,
    );
  });
});

describe("normalizePaidMediaPlanBody", () => {
  it("pads and truncates fixed-count arrays without throwing", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;

    rawBody.campaignPhases = [];
    rawBody.audienceTypes = [
      {
        slot: "01",
        archetype: "Interest Stack",
        dailyBudget: "$33/day",
        dailyBudgetProvenance: "customer",
        dailyBudgetValue: 33,
        detail: "Founder-led SaaS operators",
        sourceSection: "positioningVoC",
        grounding: "VoC says operators need proof.",
      },
    ];
    rawBody.anglesToTest = getRepeatedRows(rawBody.anglesToTest, 6);
    rawBody.creativeFramework = getRepeatedRows(rawBody.creativeFramework, 10);
    rawBody.funnelIdeation = [];
    rawBody.competitorReviewInsights = [];
    rawBody.channelSuggestions = [
      {
        channel: "Website",
        recommendation: "Rewrite the hero CTA around the audit proof.",
        verdict: "start",
        sourceSection: "offer diagnostic",
      },
    ];
    rawBody.kpis = [];

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignPhases).toHaveLength(2);
    expect(normalized.audienceTypes).toHaveLength(3);
    expect(normalized.anglesToTest).toHaveLength(4);
    expect(normalized.creativeFramework).toHaveLength(8);
    expect(normalized.funnelIdeation).toHaveLength(3);
    expect(normalized.competitorReviewInsights).toHaveLength(3);
    expect(normalized.channelSuggestions).toHaveLength(4);
    expect(normalized.kpis).toHaveLength(3);
    expect(normalized.audienceTypes[0]?.sourceSection).toBe(
      "positioningVoiceOfCustomer",
    );
    expect(normalized.audienceTypes[0]?.dailyBudgetProvenance).toBe(
      "user-supplied",
    );
    expect(normalized.channelSuggestions[0]?.verdict).toBe("ADD");
  });

  it("accepts old wrapped arrays during rollout and emits the lean shape", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    rawBody.campaignPhases = {
      phases: paidMediaPlanFixtureArtifact.body.campaignPhases,
      prose: "legacy wrapper",
    };
    rawBody.audienceTypes = {
      audiences: paidMediaPlanFixtureArtifact.body.audienceTypes,
      prose: "legacy wrapper",
    };
    rawBody.anglesToTest = {
      angles: paidMediaPlanFixtureArtifact.body.anglesToTest,
      prose: "legacy wrapper",
    };

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(Array.isArray(normalized.campaignPhases)).toBe(true);
    expect(Array.isArray(normalized.audienceTypes)).toBe(true);
    expect(Array.isArray(normalized.anglesToTest)).toBe(true);
    expect(paidMediaPlanBodySchema.safeParse(normalized).success).toBe(true);
  });
});

describe("budget honesty (B3: no placeholder, no fabrication)", () => {
  it("makes $[Budget]-style template literals unrepresentable in a committed plan", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.monthlyBudget = "$[Budget] / Month";
    overview.monthlyBudgetProvenance = "unknown";
    overview.monthlyBudgetValue = 5000; // fabricated sibling must drop
    overview.dailySpend = "$ [ Budget ] per day";
    overview.dailySpendProvenance = "unknown";
    overview.dailySpendValue = 166;
    const phases = rawBody.campaignPhases as Array<Record<string, unknown>>;
    phases[0]!.monthlyBudget = "[Budget]";
    phases[0]!.monthlyBudgetProvenance = "unknown";
    phases[0]!.monthlyBudgetValue = 5000;
    phases[1]!.monthlyBudget = "$[budget] / Month";
    phases[1]!.monthlyBudgetProvenance = "unknown";
    phases[1]!.monthlyBudgetValue = 5000;
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    audiences[0]!.dailyBudget = "$[Budget] / 3";
    audiences[0]!.dailyBudgetProvenance = "unknown";
    audiences[0]!.dailyBudgetValue = 55;

    const normalized = normalizePaidMediaPlanBody(rawBody);
    const serialized = JSON.stringify(normalized);

    // The spec's verification regex: the literal must not appear ANYWHERE.
    expect(serialized).not.toMatch(/\$\s*\[\s*Budget\s*\]/i);
    expect(serialized).not.toMatch(/\[\s*Budget\s*\]/i);

    // Honest no-budget state, never a fabricated number.
    expect(normalized.campaignOverview.monthlyBudget).toBe(
      "Budget not provided — enter a monthly budget to compute the spend plan",
    );
    expect(normalized.campaignOverview.dailySpend).toBe(
      "Daily spend not provided",
    );
    expect(normalized.campaignOverview.monthlyBudgetValue).toBeUndefined();
    expect(normalized.campaignOverview.dailySpendValue).toBeUndefined();
    expect(normalized.campaignOverview.monthlyBudget).not.toMatch(/\$\s*\d/);
    expect(normalized.campaignOverview.dailySpend).not.toMatch(/\$\s*\d/);

    for (const phase of normalized.campaignPhases) {
      expect(phase.monthlyBudget).not.toMatch(/\$\s*\d/);
      expect(phase.monthlyBudgetValue).toBeUndefined();
    }
    expect(normalized.audienceTypes[0]?.dailyBudget).toBe(
      "Daily budget not provided",
    );
    expect(normalized.audienceTypes[0]?.dailyBudgetValue).toBeUndefined();
  });

  it("scrubs a placeholder that leaks into prose instead of committing template residue", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.prose = "We allocate $[Budget] / Month across Meta placements.";

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(JSON.stringify(normalized)).not.toMatch(/\$\s*\[\s*Budget\s*\]/i);
    expect(normalized.campaignOverview.prose).toBe(
      "Paid media plan overview needs review.",
    );
  });

  it("preserves real user-supplied budget math (monthly 6000 → daily 200, phase split intact)", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.monthlyBudget = "$6,000 / Month";
    overview.monthlyBudgetValue = 6000;
    overview.monthlyBudgetProvenance = "user-supplied";
    overview.dailySpend = "$200 / day";
    overview.dailySpendValue = 200;
    overview.dailySpendProvenance = "user-supplied";
    const phases = rawBody.campaignPhases as Array<Record<string, unknown>>;
    for (const phase of phases) {
      phase.monthlyBudget = "$6,000 / Month";
      phase.monthlyBudgetValue = 6000;
      phase.monthlyBudgetProvenance = "user-supplied";
    }

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignOverview.monthlyBudget).toBe("$6,000 / Month");
    expect(normalized.campaignOverview.monthlyBudgetValue).toBe(6000);
    expect(normalized.campaignOverview.dailySpendValue).toBe(200);
    // daily = monthly / 30 — the only permitted math holds.
    expect((normalized.campaignOverview.dailySpendValue ?? 0) * 30).toBe(
      normalized.campaignOverview.monthlyBudgetValue,
    );
    for (const phase of normalized.campaignPhases) {
      expect(phase.monthlyBudgetValue).toBe(6000);
      expect(phase.monthlyBudget).toBe("$6,000 / Month");
    }
  });
});

describe("validatePaidMediaPlanMinimums", () => {
  it("accepts the normalized fixture without strategic capstone fields", () => {
    const artifact = cloneFixture();

    expect(validatePaidMediaPlanMinimums(artifact)).toEqual({
      ok: true,
      errors: [],
    });
  });
});

describe("budget honesty — provenance teeth (B3 supplement)", () => {
  // Complements the "no placeholder, no fabrication" suite above: there the
  // placeholder rows already claim provenance "unknown", so the label-driven
  // provenance override is never exercised. These tests pin the teeth — a
  // placeholder label next to a CLAIMED user-supplied provenance must still
  // force "unknown" and drop the fabricated numeric sibling.
  const BUDGET_LEAK_PATTERN = /\$\s*\[\s*Budget\s*\]/i;
  const TEMPLATE_TOKEN_PATTERN = /[\[{]\s*budget\s*[\]}]/i;

  function getRawBody(): Record<string, unknown> {
    return structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
  }

  it("forces provenance to unknown and drops fabricated siblings when a placeholder label claims user-supplied provenance", () => {
    const rawBody = getRawBody();
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.monthlyBudget = "$[Budget] / Month";
    overview.monthlyBudgetValue = 6000; // fabricated next to a placeholder — must not survive
    overview.monthlyBudgetProvenance = "user-supplied";
    overview.dailySpend = "$ [ Budget ] / 30";
    overview.dailySpendValue = 200;
    overview.dailySpendProvenance = "model-estimated";

    for (const phase of rawBody.campaignPhases as Array<
      Record<string, unknown>
    >) {
      phase.monthlyBudget = "[Budget]";
      phase.monthlyBudgetValue = 6000;
      phase.monthlyBudgetProvenance = "user-supplied";
    }

    for (const audience of rawBody.audienceTypes as Array<
      Record<string, unknown>
    >) {
      audience.dailyBudget = "{budget} / 3";
      audience.dailyBudgetValue = 66;
      audience.dailyBudgetProvenance = "user-supplied";
    }

    const normalized = normalizePaidMediaPlanBody(rawBody);
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(BUDGET_LEAK_PATTERN);
    expect(serialized).not.toMatch(TEMPLATE_TOKEN_PATTERN);
    expect(normalized.campaignOverview.monthlyBudget).toBe(
      "Budget not provided — enter a monthly budget to compute the spend plan",
    );
    expect(normalized.campaignOverview.monthlyBudgetValue).toBeUndefined();
    expect(normalized.campaignOverview.monthlyBudgetProvenance).toBe("unknown");
    expect(normalized.campaignOverview.dailySpend).toBe(
      "Daily spend not provided",
    );
    expect(normalized.campaignOverview.dailySpendValue).toBeUndefined();
    expect(normalized.campaignOverview.dailySpendProvenance).toBe("unknown");

    for (const phase of normalized.campaignPhases) {
      expect(phase.monthlyBudget).toBe("Budget not provided");
      expect(phase.monthlyBudgetValue).toBeUndefined();
      expect(phase.monthlyBudgetProvenance).toBe("unknown");
    }

    for (const audience of normalized.audienceTypes) {
      expect(audience.dailyBudget).toBe("Daily budget not provided");
      expect(audience.dailyBudgetValue).toBeUndefined();
      expect(audience.dailyBudgetProvenance).toBe("unknown");
    }
  });

  it("renders the honest no-budget state with zero fabricated dollar numbers when the budget is missing", () => {
    const rawBody = getRawBody();
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.monthlyBudget = "";
    delete overview.monthlyBudgetValue;
    overview.monthlyBudgetProvenance = "unknown";
    overview.dailySpend = "";
    delete overview.dailySpendValue;
    overview.dailySpendProvenance = "unknown";

    for (const phase of rawBody.campaignPhases as Array<
      Record<string, unknown>
    >) {
      phase.monthlyBudget = "";
      delete phase.monthlyBudgetValue;
      phase.monthlyBudgetProvenance = "unknown";
    }

    for (const audience of rawBody.audienceTypes as Array<
      Record<string, unknown>
    >) {
      audience.dailyBudget = "";
      delete audience.dailyBudgetValue;
      audience.dailyBudgetProvenance = "unknown";
    }

    const normalized = normalizePaidMediaPlanBody(rawBody);
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(BUDGET_LEAK_PATTERN);
    expect(normalized.campaignOverview.monthlyBudget).toBe(
      "Budget not provided — enter a monthly budget to compute the spend plan",
    );
    expect(normalized.campaignOverview.monthlyBudgetValue).toBeUndefined();
    expect(normalized.campaignOverview.dailySpendValue).toBeUndefined();
    // No fabricated dollar figure may appear in any budget label.
    expect(normalized.campaignOverview.monthlyBudget).not.toMatch(/\$\s*\d/);
    expect(normalized.campaignOverview.dailySpend).not.toMatch(/\$\s*\d/);
    for (const phase of normalized.campaignPhases) {
      expect(phase.monthlyBudget).not.toMatch(/\$\s*\d/);
      expect(phase.monthlyBudgetValue).toBeUndefined();
    }
    for (const audience of normalized.audienceTypes) {
      expect(audience.dailyBudget).not.toMatch(/\$\s*\d/);
      expect(audience.dailyBudgetValue).toBeUndefined();
    }
  });

  it("keeps snap-to-unknown: numeric siblings drop when provenance snaps to unknown", () => {
    const rawBody = getRawBody();
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.monthlyBudget = "$6,000 / month";
    overview.monthlyBudgetValue = 6000;
    overview.monthlyBudgetProvenance = "made-up-provenance";

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignOverview.monthlyBudgetProvenance).toBe("unknown");
    expect(normalized.campaignOverview.monthlyBudgetValue).toBeUndefined();
  });
});

function getRepeatedRows(value: unknown, count: number): unknown[] {
  const source = Array.isArray(value) ? value : [];
  const first = source[0] ?? {};

  return Array.from({ length: count }, () => structuredClone(first));
}

describe("SOP projected-results table (W3)", () => {
  function rawBodyWithProjectedResults(rows: unknown[]): Record<string, unknown> {
    const rawBody = structuredClone(
      paidMediaPlanFixtureArtifact.body,
    ) as unknown as Record<string, unknown>;
    rawBody.projectedResults = rows;
    return rawBody;
  }

  const baseRow = {
    targetIcp: "RevOps leads at mid-market SaaS",
    kpi: "SQL",
    kpiCostValue: 450,
    kpiCostProvenance: "tool-measured",
    objective: "Pipeline creation",
    durationLabel: "Months 1-2",
    phaseMonthlyBudgetValue: 10000,
    phaseMonthlyBudgetProvenance: "user-supplied",
    sourceSection: "gtmBrief",
  };

  it("computes the count (floor of budget/kpiCost), overwrites model math, and pins the SOP margin", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithProjectedResults([
        { ...baseRow, projectedCountValue: 999_999, marginOfErrorPercent: 5 },
      ]),
    );
    const row = normalized.projectedResults[0];

    expect(row?.projectedCountValue).toBe(22);
    expect(row?.marginOfErrorPercent).toBe(20);
    expect(row?.projectedCountProvenance).toBe("tool-measured");
  });

  it("inherits the WEAKEST input provenance for the count", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithProjectedResults([
        {
          ...baseRow,
          kpiCostProvenance: "model-estimated",
          phaseMonthlyBudgetProvenance: "user-supplied",
        },
      ]),
    );

    expect(normalized.projectedResults[0]?.projectedCountProvenance).toBe(
      "model-estimated",
    );
  });

  it("omits the count when kpiCost is unknown or zero — never invented", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithProjectedResults([
        { ...baseRow, kpiCostValue: 0 },
        { ...baseRow, kpiCostValue: undefined, kpiCostProvenance: "unknown" },
      ]),
    );

    for (const row of normalized.projectedResults) {
      expect(row.projectedCountValue).toBeUndefined();
      expect(row.projectedCountProvenance).toBeUndefined();
      expect(row.marginOfErrorPercent).toBe(20);
    }
  });

  it("coerces numeric-string money values before the math", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithProjectedResults([
        {
          ...baseRow,
          kpiCostValue: "$450",
          phaseMonthlyBudgetValue: "10,000",
        },
      ]),
    );

    expect(normalized.projectedResults[0]?.projectedCountValue).toBe(22);
  });

  it("pads to one honest gap row when the model omits the table", () => {
    const rawBody = structuredClone(
      paidMediaPlanFixtureArtifact.body,
    ) as unknown as Record<string, unknown>;
    delete rawBody.projectedResults;

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.projectedResults).toHaveLength(1);
    expect(normalized.projectedResults[0]?.targetIcp).toContain("Evidence gap");
    expect(normalized.projectedResults[0]?.projectedCountValue).toBeUndefined();
  });

  it("rejects negative counts at the schema layer", () => {
    const body = structuredClone(
      paidMediaPlanFixtureArtifact.body,
    ) as unknown as Record<string, unknown>;
    body.projectedResults = [
      { ...baseRow, projectedCountValue: -5, marginOfErrorPercent: 20 },
    ];

    expect(paidMediaPlanBodySchema.safeParse(body).success).toBe(false);
  });

  it("validator demands at least one SUBSTANTIVE row — padded gap rows do not count", () => {
    const artifact = cloneFixture();
    const body = artifact.body as unknown as Record<string, unknown>;
    body.projectedResults = [];
    expect(validatePaidMediaPlanMinimums(artifact).ok).toBe(false);

    // The normalizer's min-1 pad (all-gap row) must not satisfy the floor.
    const padded = normalizePaidMediaPlanBody({
      ...structuredClone(paidMediaPlanFixtureArtifact.body),
      projectedResults: undefined,
    } as unknown as Record<string, unknown>);
    body.projectedResults = padded.projectedResults;
    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("substantive SOP row");
  });

  it("validator accepts a substantive row even when the KPI cost is honestly unknown", () => {
    const artifact = cloneFixture();
    const body = artifact.body as unknown as Record<string, unknown>;
    body.projectedResults = normalizePaidMediaPlanBody(
      rawBodyWithProjectedResults([
        { ...baseRow, kpiCostValue: undefined, kpiCostProvenance: "unknown" },
      ]),
    ).projectedResults;

    expect(validatePaidMediaPlanMinimums(artifact).ok).toBe(true);
  });
});
