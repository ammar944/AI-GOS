import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { paidMediaPlanFixtureArtifact } from "../../../fixtures/paid-media-plan-artifact";
import {
  collectPaidMediaBudgetCascadeViolations,
  normalizePaidMediaPlanBody,
  paidMediaMoneyProvenanceValues,
  paidMediaPlanBodySchema,
  paidMediaPlanSectionOutputSchema,
  parsePaidMediaTargetCacValue,
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

  it("keeps unknown legacy sources invalid instead of snapping to GTM brief", () => {
    expect(snapSourceSection("legacy-thinker")).toBe("legacy-thinker");
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
      "derived",
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
  it("preserves delivered row counts without padding or truncation", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;

    rawBody.campaignPhases = getRepeatedRows(rawBody.campaignPhases, 1);
    // dailyBudgetValue 100 = the overview's dailySpendValue, so the single
    // audience row keeps the budget cascade reconciling.
    rawBody.audienceTypes = [
      {
        slot: "01",
        archetype: "Interest Stack",
        dailyBudget: "$100/day",
        dailyBudgetProvenance: "customer",
        dailyBudgetValue: 100,
        detail: "Founder-led SaaS operators",
        sourceSection: "positioningVoC",
        grounding: "VoC says operators need proof.",
      },
    ];
    rawBody.anglesToTest = getRepeatedRows(rawBody.anglesToTest, 2);
    rawBody.creativeFramework = getRepeatedRows(rawBody.creativeFramework, 3);
    rawBody.funnelIdeation = getRepeatedRows(rawBody.funnelIdeation, 1);
    rawBody.salesProcess = [];
    rawBody.competitorReviewInsights = [];
    rawBody.channelSuggestions = [
      {
        channel: "Website",
        recommendation: "Rewrite the hero CTA around the audit proof.",
        verdict: "start",
        sourceSection: "offer diagnostic",
      },
    ];
    rawBody.kpis = getRepeatedRows(rawBody.kpis, 2);

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignPhases).toHaveLength(1);
    expect(normalized.audienceTypes).toHaveLength(1);
    expect(normalized.anglesToTest).toHaveLength(2);
    expect(normalized.creativeFramework).toHaveLength(3);
    expect(normalized.funnelIdeation).toHaveLength(1);
    expect(normalized.salesProcess).toHaveLength(1);
    expect(normalized.salesProcess[0]?.assetType).toBe("gap");
    expect(normalized.competitorReviewInsights).toHaveLength(0);
    expect(normalized.channelSuggestions).toHaveLength(1);
    expect(normalized.kpis).toHaveLength(2);
    expect(normalized.audienceTypes[0]?.sourceSection).toBe(
      "positioningVoiceOfCustomer",
    );
    expect(normalized.audienceTypes[0]?.dailyBudgetProvenance).toBe(
      "user-supplied",
    );
    expect(normalized.channelSuggestions[0]?.verdict).toBe("ADD");
  });

  it("fails under-count arrays instead of padding repair rows", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    rawBody.anglesToTest = getRepeatedRows(rawBody.anglesToTest, 1);

    expect(() => normalizePaidMediaPlanBody(rawBody)).toThrow();
  });

  it("maps unknown sourceSection to 'unattributed' and unknown verdict to REVIEW instead of crashing", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    rawBody.channelSuggestions = [
      {
        channel: "Website",
        recommendation: "Rewrite the hero CTA around the audit proof.",
        verdict: "maybe",
        sourceSection: "legacy-thinker",
      },
    ];

    const normalized = normalizePaidMediaPlanBody(rawBody);
    const suggestion = (normalized.channelSuggestions as Array<Record<string, unknown>>)[0];
    expect(suggestion?.sourceSection).toBe("unattributed");
    expect(suggestion?.verdict).toBe("REVIEW");
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
    // Keep the audience split reconciling with the new $200/day spend so the
    // cascade pass leaves the user-supplied math untouched.
    const audienceSplits = [66.67, 66.67, 66.66];
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    audiences.forEach((audience, index) => {
      audience.dailyBudget = `$${audienceSplits[index]}/day`;
      audience.dailyBudgetValue = audienceSplits[index];
      audience.dailyBudgetProvenance = "user-supplied";
    });

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignOverview.monthlyBudget).toBe("$6,000/month");
    expect(normalized.campaignOverview.monthlyBudgetValue).toBe(6000);
    expect(normalized.campaignOverview.dailySpend).toBe("$200/day");
    expect(normalized.campaignOverview.dailySpendValue).toBe(200);
    // daily = monthly / 30 — the only permitted math holds.
    expect((normalized.campaignOverview.dailySpendValue ?? 0) * 30).toBe(
      normalized.campaignOverview.monthlyBudgetValue,
    );
    for (const phase of normalized.campaignPhases) {
      expect(phase.monthlyBudgetValue).toBe(6000);
      expect(phase.monthlyBudget).toBe("$6,000/month");
    }
    normalized.audienceTypes.forEach((audience, index) => {
      expect(audience.dailyBudgetValue).toBe(audienceSplits[index]);
      expect(audience.dailyBudget).toBe(`$${audienceSplits[index]}/day`);
      expect(audience.dailyBudgetProvenance).toBe("user-supplied");
    });
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

  it("snaps model-authored derived money provenance to model-estimated unless code repairs it", () => {
    const rawBody = getRawBody();
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    audiences[0]!.dailyBudgetProvenance = "derived";

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(collectPaidMediaBudgetCascadeViolations(normalized)).toEqual([]);
    expect(normalized.audienceTypes[0]?.dailyBudgetValue).toBe(33.33);
    expect(normalized.audienceTypes[0]?.dailyBudgetProvenance).toBe(
      "model-estimated",
    );
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
      // No count -> no margin: a ±20% on a number that does not exist is
      // dishonest, so the SOP constant only rides alongside a real count.
      expect(row.marginOfErrorPercent).toBeUndefined();
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

  it("synthesizes the projected-results table from budgeted phases when the model omits it", () => {
    // Run f3993043: the empty-array floor killed the section. The SOP table
    // is derivable from the plan's own cascade — one row per budgeted phase,
    // KPI cost honestly unknown unless the brief-CAC bridge fills it.
    const rawBody = structuredClone(
      paidMediaPlanFixtureArtifact.body,
    ) as unknown as Record<string, unknown>;
    delete rawBody.projectedResults;

    const normalized = normalizePaidMediaPlanBody(rawBody);
    const phases = normalized.campaignPhases.filter(
      (phase) => phase.monthlyBudgetValue !== undefined,
    );

    expect(normalized.projectedResults.length).toBe(phases.length);
    expect(normalized.projectedResults.length).toBeGreaterThan(0);
    for (const row of normalized.projectedResults) {
      expect(row.sourceSection).toBe("gtmBrief");
      expect(row.kpiCostProvenance).toBe("unknown");
      expect(row.projectedCountValue).toBeUndefined();
      expect(row.marginOfErrorPercent).toBeUndefined();
    }
  });

  it("bridges synthesized projected rows through the brief target CAC", () => {
    const rawBody = structuredClone(
      paidMediaPlanFixtureArtifact.body,
    ) as unknown as Record<string, unknown>;
    delete rawBody.projectedResults;
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.primaryKpi = "Paid signups";

    const normalized = normalizePaidMediaPlanBody(rawBody, {
      targetCac: "$1,000",
    });

    const budgeted = normalized.projectedResults.filter(
      (row) => row.phaseMonthlyBudgetValue !== undefined,
    );
    expect(budgeted.length).toBeGreaterThan(0);
    for (const row of budgeted) {
      expect(row.kpiCostProvenance).toBe("user-supplied");
      expect(row.kpiCostValue).toBe(1000);
      expect(row.projectedCountValue).toBe(
        Math.floor((row.phaseMonthlyBudgetValue as number) / 1000),
      );
    }
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

  it("validator demands at least one SUBSTANTIVE row — explicit gap rows do not count", () => {
    const artifact = cloneFixture();
    const body = artifact.body as unknown as Record<string, unknown>;
    body.projectedResults = [
      {
        targetIcp: "Evidence gap: target ICP missing.",
        kpi: "Evidence gap: KPI missing.",
        kpiCostProvenance: "unknown",
        objective: "Evidence gap: objective missing.",
        durationLabel: "Evidence gap: duration missing.",
        phaseMonthlyBudgetProvenance: "unknown",
        marginOfErrorPercent: 20,
        sourceSection: "gtmBrief",
      },
    ];
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

describe("budget cascade reconciliation (W2)", () => {
  function getRawBody(): Record<string, unknown> {
    return structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
  }

  it("validator flags an audience split that does not sum to the daily spend within $5", () => {
    const artifact = cloneFixture();
    artifact.body.audienceTypes[0]!.dailyBudgetValue = 300;

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "sum of dailyBudgetValue",
    );
  });

  it("validator flags dailySpendValue * 30 drifting from monthlyBudgetValue beyond $25", () => {
    const artifact = cloneFixture();
    artifact.body.campaignOverview.dailySpendValue = 833;
    artifact.body.campaignOverview.monthlyBudgetValue = 30000;

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("dailySpendValue * 30");
  });

  it("validator flags a single phase budgeting more than the plan's monthly budget", () => {
    const artifact = cloneFixture();
    artifact.body.campaignPhases[0]!.monthlyBudgetValue = 9000;

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("body.campaignPhases[0]");
  });

  it("validator allows overlapping phases — no phase-sum constraint", () => {
    const artifact = cloneFixture();
    // Two phases at the full monthly budget each: legal (phases overlap).
    artifact.body.campaignPhases[0]!.monthlyBudgetValue = 3000;
    artifact.body.campaignPhases[1]!.monthlyBudgetValue = 3000;

    expect(validatePaidMediaPlanMinimums(artifact).ok).toBe(true);
  });

  it("normalizes a non-reconciling audience split by rescaling with largest remainder (run d838ed4e shape)", () => {
    const rawBody = getRawBody();
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    // 300 + 33.33 + 33.33 = 366.66 vs dailySpendValue 100 — violates the $5 rule.
    audiences[0]!.dailyBudgetValue = 300;

    const normalized = normalizePaidMediaPlanBody(rawBody);

    // Code owns the sum: keep the model's ratios, repair to exact dollars.
    expect(normalized.audienceTypes.map((audience) => audience.dailyBudgetValue)).toEqual([
      82,
      9,
      9,
    ]);
    for (const audience of normalized.audienceTypes) {
      expect(audience.dailyBudgetProvenance).toBe("derived");
      expect(audience.dailyBudget).toBe(`$${audience.dailyBudgetValue}/day`);
    }
    // The anchor legs are untouched.
    expect(normalized.campaignOverview.dailySpendValue).toBe(100);
    expect(normalized.campaignOverview.monthlyBudgetValue).toBe(3000);
  });

  it("normalizes a daily spend that contradicts the monthly budget, then rescales audiences", () => {
    const rawBody = getRawBody();
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.dailySpendValue = 150; // 150 * 30 = 4500 vs monthly 3000
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    for (const audience of audiences) {
      audience.dailyBudgetValue = 50; // sums to 150 = the (pre-drop) daily spend
    }

    const normalized = normalizePaidMediaPlanBody(rawBody);

    // Monthly is the anchor: daily becomes round(3000 / 30), not a dropped value.
    expect(normalized.campaignOverview.dailySpendValue).toBe(100);
    expect(normalized.campaignOverview.dailySpend).toBe("$100/day");
    expect(normalized.campaignOverview.dailySpendProvenance).toBe("derived");
    expect(normalized.campaignOverview.monthlyBudgetValue).toBe(3000);
    expect(normalized.audienceTypes.map((audience) => audience.dailyBudgetValue)).toEqual([
      34,
      33,
      33,
    ]);
    for (const audience of normalized.audienceTypes) {
      expect(audience.dailyBudgetProvenance).toBe("derived");
    }
  });

  it("normalizes an offending phase budget by clamping it to the monthly budget", () => {
    const rawBody = getRawBody();
    const phases = rawBody.campaignPhases as Array<Record<string, unknown>>;
    phases[0]!.monthlyBudgetValue = 9000; // exceeds monthly 3000

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignPhases[0]?.monthlyBudgetValue).toBe(3000);
    expect(normalized.campaignPhases[0]?.monthlyBudget).toBe("$3,000/month");
    expect(normalized.campaignPhases[0]?.monthlyBudgetProvenance).toBe(
      "derived",
    );
    expect(normalized.campaignPhases[1]?.monthlyBudgetValue).toBe(3000);
  });

  it("rescales the f3993043 audience budget fixture to exact-sum daily dollars", () => {
    const rawBody = getRawBody();
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.monthlyBudget = "$25,000 monthly";
    overview.monthlyBudgetValue = 25000;
    overview.monthlyBudgetProvenance = "user-supplied";
    overview.dailySpend = "$833 daily";
    overview.dailySpendValue = 833;
    overview.dailySpendProvenance = "user-supplied";
    rawBody.audienceTypes = [500, 200, 125, 208].map((dailyBudgetValue, index) => ({
      ...(paidMediaPlanFixtureArtifact.body.audienceTypes[index % 3] ?? {}),
      slot: `0${index + 1}`,
      dailyBudget: `$${dailyBudgetValue}/day`,
      dailyBudgetValue,
      dailyBudgetProvenance: "user-supplied",
    }));

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignOverview.monthlyBudget).toBe("$25,000/month");
    expect(normalized.campaignOverview.dailySpend).toBe("$833/day");
    expect(normalized.audienceTypes.map((audience) => audience.dailyBudgetValue)).toEqual([
      403,
      161,
      101,
      168,
    ]);
    expect(normalized.audienceTypes.map((audience) => audience.dailyBudget)).toEqual([
      "$403/day",
      "$161/day",
      "$101/day",
      "$168/day",
    ]);
    expect(normalized.audienceTypes.map((audience) => audience.dailyBudgetProvenance)).toEqual([
      "derived",
      "derived",
      "derived",
      "derived",
    ]);
    expect(
      normalized.audienceTypes.reduce(
        (sum, audience) => sum + (audience.dailyBudgetValue ?? 0),
        0,
      ),
    ).toBe(833);
    expect(collectPaidMediaBudgetCascadeViolations(normalized)).toEqual([]);
  });

  it("fills missing audience values from the remaining daily budget", () => {
    const rawBody = getRawBody();
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    audiences[0]!.dailyBudgetValue = 40;
    audiences[1]!.dailyBudgetValue = 20;
    delete audiences[2]!.dailyBudgetValue;

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.audienceTypes.map((audience) => audience.dailyBudgetValue)).toEqual([
      40,
      20,
      40,
    ]);
    expect(normalized.audienceTypes[0]?.dailyBudgetProvenance).toBe("model-estimated");
    expect(normalized.audienceTypes[1]?.dailyBudgetProvenance).toBe("model-estimated");
    expect(normalized.audienceTypes[2]?.dailyBudgetProvenance).toBe("derived");
    expect(collectPaidMediaBudgetCascadeViolations(normalized)).toEqual([]);
  });

  it("equal-splits audience values when daily spend is known and all audience values are missing", () => {
    const rawBody = getRawBody();
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    for (const audience of audiences) {
      delete audience.dailyBudgetValue;
    }

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.audienceTypes.map((audience) => audience.dailyBudgetValue)).toEqual([
      34,
      33,
      33,
    ]);
    for (const audience of normalized.audienceTypes) {
      expect(audience.dailyBudgetProvenance).toBe("derived");
      expect(audience.dailyBudget).toBe(`$${audience.dailyBudgetValue}/day`);
    }
    expect(collectPaidMediaBudgetCascadeViolations(normalized)).toEqual([]);
  });

  it("a normalized body always re-validates clean — a committed cascade can never contradict itself", () => {
    const rawBody = getRawBody();
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.dailySpendValue = 833; // every leg broken at once
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    audiences[0]!.dailyBudgetValue = 300;
    const phases = rawBody.campaignPhases as Array<Record<string, unknown>>;
    phases[0]!.monthlyBudgetValue = 15000;

    const artifact = cloneFixture();
    artifact.body = normalizePaidMediaPlanBody(rawBody);

    expect(validatePaidMediaPlanMinimums(artifact).ok).toBe(true);
    expect(collectPaidMediaBudgetCascadeViolations(artifact.body)).toEqual([]);
  });
});

describe("channel suggestions substantive floor (W2)", () => {
  it("fails a 100%-placeholder channel table into repair instead of shipping it", () => {
    const artifact = cloneFixture();
    artifact.body.channelSuggestions = artifact.body.channelSuggestions.map(
      (suggestion) => ({
        ...suggestion,
        recommendation: "Evidence gap: channel recommendation missing.",
      }),
    );

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("body.channelSuggestions");
  });

  it("accepts a table with at least one substantive recommendation", () => {
    const artifact = cloneFixture();
    artifact.body.channelSuggestions = artifact.body.channelSuggestions.map(
      (suggestion, index) =>
        index === 0
          ? suggestion
          : {
              ...suggestion,
              recommendation: "Evidence gap: channel recommendation missing.",
            },
    );

    expect(validatePaidMediaPlanMinimums(artifact).ok).toBe(true);
  });

  it("warns on key drift when a row falls back to the placeholder despite carrying stray string keys", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const rawBody = structuredClone(
        paidMediaPlanFixtureArtifact.body,
      ) as Record<string, unknown>;
      rawBody.channelSuggestions = [
        {
          channel: "Website",
          suggestion: "Rewrite the hero CTA around the audit proof.",
          verdict: "FIX",
          sourceSection: "positioningOfferDiagnostic",
        },
      ];

      const normalized = normalizePaidMediaPlanBody(rawBody);

      expect(normalized.channelSuggestions[0]?.recommendation).toBe(
        "Evidence gap: channel recommendation missing.",
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("possible key drift"),
        expect.objectContaining({ strayStringKeys: ["suggestion"] }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("display-string provenance hygiene (W2)", () => {
  it("regenerates money display strings from numeric siblings — the enum is the only provenance writer", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.monthlyBudget = "$3,000/month (user-supplied)";
    overview.dailySpend = "$100/day (model-estimated)";
    const phases = rawBody.campaignPhases as Array<Record<string, unknown>>;
    phases[0]!.monthlyBudget = "$3,000/month (60% of search budget) (user-supplied)";
    const audiences = rawBody.audienceTypes as Array<Record<string, unknown>>;
    audiences[0]!.dailyBudget = "$33.33/day (20% of total) (user-supplied)";

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignOverview.monthlyBudget).toBe("$3,000/month");
    expect(normalized.campaignOverview.dailySpend).toBe("$100/day");
    expect(normalized.campaignPhases[0]?.monthlyBudget).toBe("$3,000/month");
    expect(normalized.audienceTypes[0]?.dailyBudget).toBe("$33.33/day");
  });

  it("keeps non-provenance parentheticals intact only when no numeric sibling exists", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    const overview = rawBody.campaignOverview as Record<string, unknown>;
    overview.monthlyBudget = "$3,000/month (60% of search budget)";
    delete overview.monthlyBudgetValue;

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignOverview.monthlyBudget).toBe(
      "$3,000/month (60% of search budget)",
    );
  });
});

describe("creative strategy counts single-writer (W2)", () => {
  function getRawBody(): Record<string, unknown> {
    return structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
  }

  it("always overwrites model-emitted counts (run d838ed4e shipped free-invented 9/6/5)", () => {
    const rawBody = getRawBody();
    rawBody.creativeStrategy = {
      prose: "Creative mix prose.",
      staticCount: 6,
      videoCount: 9,
      totalPerAudience: 5,
    };

    const normalized = normalizePaidMediaPlanBody(rawBody);

    // Fixture slot labels (PST/Objection/USP/...) are unclassifiable and no
    // capacity is supplied -> SOP constants 5 static / 3 video / 8 total.
    expect(normalized.creativeStrategy.staticCount).toBe(5);
    expect(normalized.creativeStrategy.videoCount).toBe(3);
    expect(normalized.creativeStrategy.totalPerAudience).toBe(8);
    expect(normalized.creativeStrategy.prose).toBe("Creative mix prose.");
  });

  it("computes counts when the model omits them — no silent model-default path left", () => {
    const rawBody = getRawBody();
    rawBody.creativeStrategy = { prose: "Counts omitted by the model." };

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.creativeStrategy.staticCount).toBe(5);
    expect(normalized.creativeStrategy.videoCount).toBe(3);
    expect(normalized.creativeStrategy.totalPerAudience).toBe(8);
  });

  it("derives counts from creativeFramework slot labels when every slot is classifiable", () => {
    const rawBody = getRawBody();
    const slots = rawBody.creativeFramework as Array<Record<string, unknown>>;
    rawBody.creativeFramework = [
      { ...slots[0]!, label: "Static headline 1" },
      { ...slots[1]!, label: "UGC video walkthrough" },
      { ...slots[2]!, label: "Static image proof stack" },
    ];

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.creativeStrategy.staticCount).toBe(2);
    expect(normalized.creativeStrategy.videoCount).toBe(1);
    expect(normalized.creativeStrategy.totalPerAudience).toBe(3);
  });

  it("keys the default off the brief's creativeCapacity when slot labels are unclassifiable", () => {
    const normalized = normalizePaidMediaPlanBody(getRawBody(), {
      creativeCapacity: "lean",
    });

    expect(normalized.creativeStrategy.staticCount).toBe(3);
    expect(normalized.creativeStrategy.videoCount).toBe(1);
    expect(normalized.creativeStrategy.totalPerAudience).toBe(4);
  });

  it("accepts model output that omits the counts at the schema layer", () => {
    const body = structuredClone(
      paidMediaPlanFixtureArtifact.body,
    ) as unknown as Record<string, unknown>;
    body.creativeStrategy = { prose: "Counts are computed by the runner." };

    expect(paidMediaPlanBodySchema.safeParse(body).success).toBe(true);
  });
});

describe("brief target-CAC bridge for projected results (W2)", () => {
  function rawBodyWithRows(rows: unknown[]): Record<string, unknown> {
    const rawBody = structuredClone(
      paidMediaPlanFixtureArtifact.body,
    ) as unknown as Record<string, unknown>;
    rawBody.projectedResults = rows;
    return rawBody;
  }

  const unknownCostRow = {
    targetIcp: "Mid-market ops teams searching competitor-alternative terms",
    kpi: "Signup",
    kpiCostProvenance: "unknown",
    objective: "Capture active evaluators",
    durationLabel: "Days 1-60",
    phaseMonthlyBudgetValue: 15000,
    phaseMonthlyBudgetProvenance: "user-supplied",
    sourceSection: "positioningDemandIntent",
  };

  it("bridges the brief's target CAC into an unknown-cost acquisition row and runs the SOP math", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithRows([unknownCostRow]),
      { targetCac: "≤$4,000" },
    );
    const row = normalized.projectedResults[0];

    expect(row?.kpiCostValue).toBe(4000);
    expect(row?.kpiCostProvenance).toBe("user-supplied");
    expect(row?.projectedCountValue).toBe(3); // floor(15000 / 4000)
    expect(row?.projectedCountProvenance).toBe("user-supplied");
    expect(row?.countBasis).toBe("At your target CAC from the GTM brief.");
    expect(row?.marginOfErrorPercent).toBe(20);
  });

  it("bridges funnel-stage KPIs conservatively at the target CAC", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithRows([{ ...unknownCostRow, kpi: "SQL" }]),
      { targetCac: "≤$4,000" },
    );
    const row = normalized.projectedResults[0];

    expect(row?.kpiCostValue).toBe(4000);
    expect(row?.kpiCostProvenance).toBe("user-supplied");
    expect(row?.projectedCountValue).toBe(3);
    expect(row?.countBasis).toBe(
      "At your target CAC from the GTM brief; no stage-to-customer conversion rate assumed.",
    );
    expect(row?.marginOfErrorPercent).toBe(20);
  });

  it("bridges the f3993043 Qualified Business-plan trial rows into counts", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithRows(
        ["Phase 1", "Phase 2", "Phase 3"].map((objective) => ({
          ...unknownCostRow,
          kpi: "Qualified Business-plan trial",
          objective,
          phaseMonthlyBudgetValue: 25000,
        })),
      ),
      { targetCac: "≤$4,000" },
    );

    expect(normalized.projectedResults).toHaveLength(3);
    for (const row of normalized.projectedResults) {
      expect(row.kpiCostValue).toBe(4000);
      expect(row.kpiCostProvenance).toBe("user-supplied");
      expect(row.projectedCountValue).toBe(6);
      expect(row.projectedCountProvenance).toBe("user-supplied");
      expect(row.countBasis).toBe(
        "At your target CAC from the GTM brief; no stage-to-customer conversion rate assumed.",
      );
    }
  });

  it("does not bridge a row whose KPI has no CAC-compatible unit", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithRows([{ ...unknownCostRow, kpi: "CTR" }]),
      { targetCac: "≤$4,000" },
    );
    const row = normalized.projectedResults[0];

    expect(row?.kpiCostValue).toBeUndefined();
    expect(row?.kpiCostProvenance).toBe("unknown");
    expect(row?.projectedCountValue).toBeUndefined();
    expect(row?.countBasis).toBeUndefined();
    expect(row?.marginOfErrorPercent).toBeUndefined();
  });

  it("does not bridge without a parseable target CAC", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithRows([unknownCostRow]),
      { targetCac: "not disclosed" },
    );
    const row = normalized.projectedResults[0];

    expect(row?.kpiCostValue).toBeUndefined();
    expect(row?.kpiCostProvenance).toBe("unknown");
  });

  it("never overrides a model-supplied KPI cost", () => {
    const normalized = normalizePaidMediaPlanBody(
      rawBodyWithRows([
        {
          ...unknownCostRow,
          kpiCostValue: 500,
          kpiCostProvenance: "tool-measured",
        },
      ]),
      { targetCac: "$4,000" },
    );
    const row = normalized.projectedResults[0];

    expect(row?.kpiCostValue).toBe(500);
    expect(row?.kpiCostProvenance).toBe("tool-measured");
  });

  it("parses common brief CAC formats", () => {
    expect(parsePaidMediaTargetCacValue("≤$4,000")).toBe(4000);
    expect(parsePaidMediaTargetCacValue("$4k")).toBe(4000);
    expect(parsePaidMediaTargetCacValue("4000")).toBe(4000);
    expect(parsePaidMediaTargetCacValue("under $1.5k blended")).toBe(1500);
    expect(parsePaidMediaTargetCacValue("not disclosed")).toBeUndefined();
    expect(parsePaidMediaTargetCacValue(undefined)).toBeUndefined();
  });
});
