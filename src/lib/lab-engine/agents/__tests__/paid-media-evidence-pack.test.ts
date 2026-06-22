import { describe, expect, it } from "vitest";

import type { ArtifactEnvelope } from "../../artifacts/artifact-envelope";
import { withPaidMediaEvidencePack } from "../paid-media-evidence-pack";

// A committed BuyerICP body carrying a named persona "Dana Ruiz" and a trigger.
function buildBuyerICPBody(): Record<string, unknown> {
  return {
    personaReality: {
      personas: [
        {
          name: "Dana Ruiz",
          title: "VP Revenue Operations",
          company: "Northwind Logistics",
          role: "economic_buyer",
          seniority: "VP",
          evidence:
            "Dana Ruiz publicly described messy CRM handoffs slowing campaign launch.",
          sourceUrl: "https://example.com/dana-ruiz",
        },
      ],
    },
    buyingContext: {
      triggers: [
        {
          name: "New funding round",
          detectionSignal: "Crunchbase funding event",
          window: "immediate",
          evidence: "Series B funding announced; budget unlocked for tooling.",
        },
      ],
    },
    icpExistenceCheck: {
      firmographicCuts: [
        {
          cutType: "industry",
          value: "Logistics",
          source: "G2",
          sourceUrl: "https://example.com/logistics",
          dateObserved: "2026-01-01",
        },
      ],
    },
    clusters: {
      venues: [
        {
          bucketType: "community",
          name: "RevOps Co-op Slack",
          sourceUrl: "https://example.com/revops",
          whyItMatters: "Buyers gather to discuss handoff tooling.",
        },
      ],
    },
  };
}

// A committed VoC body with a pain quote about slow campaign handoffs.
function buildVoiceOfCustomerBody(): Record<string, unknown> {
  return {
    painLanguage: {
      quotes: [
        {
          verbatimText:
            "Our campaign launches stall for weeks because the handoff between sales and ops is a mess.",
          source: "review_site",
          sourceUrl: "https://example.com/review-handoff",
          painTheme: "Slow handoff blocks campaign launch",
          painIntensity: "high",
        },
      ],
    },
    objections: {
      items: [
        {
          objectionText: "We already pay for a platform we barely use.",
          category: "budget",
          frequency: "recurring",
          howToHandle: "Lead with measurable activation.",
          sourceUrl: "https://example.com/objection",
        },
      ],
    },
    decisionCriteria: { criteria: [] },
    switchingStories: { stories: [] },
    successLanguage: { quotes: [] },
  };
}

function buildAudienceRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    slot: "Slot 1",
    archetype: "High Intent - ABM ICP List",
    dailyBudget: "$100",
    dailyBudgetProvenance: "derived",
    detail: "Targets VP RevOps buyers like Dana Ruiz at logistics firms.",
    sourceSection: "positioningBuyerICP",
    grounding: "Buyer ICP names Dana Ruiz, a VP Revenue Operations buyer.",
    ...overrides,
  };
}

// A committed DemandIntent body whose keywordDemand.keywords[] rows key on
// keyword/monthlyVolume/cpc/intentType (no name/competitor) — shaped like the
// frozen artifact. These rows only bind once looksLikeNamedRecords admits
// keyword-keyed records.
function buildDemandIntentBody(): Record<string, unknown> {
  return {
    keywordDemand: {
      keywords: [
        {
          keyword: "expense management software",
          monthlyVolume: 14800,
          cpc: 22.5,
          intentType: "commercial",
        },
        {
          keyword: "corporate card platform",
          monthlyVolume: 3600,
          cpc: 18.1,
          intentType: "commercial",
        },
      ],
    },
  };
}

// An angle row citing DemandIntent whose salient text overlaps a real
// keywordDemand row by >=2 meaningful tokens (the keyword phrase).
function buildDemandAngleRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    shortName: "Expense management capture",
    description:
      "Target buyers searching expense management software with a high-intent capture angle.",
    grounding:
      "DemandIntent shows commercial demand for expense management software.",
    sourceSection: "positioningDemandIntent",
    ...overrides,
  };
}

function buildCompetitorReviewRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    complaint: "Campaign launches stall because the handoff is slow.",
    howWeLeverage: "Lead ads with fast measurable handoff messaging.",
    sourceSection: "positioningVoiceOfCustomer",
    grounding: "VoC pain quote names slow handoff blocking campaign launch.",
    ...overrides,
  };
}

function buildPaidMediaArtifact(
  body: Record<string, unknown>,
): ArtifactEnvelope {
  return {
    id: "artifact-1",
    runId: "run-1",
    sectionId: "positioningPaidMediaPlan",
    sectionTitle: "Paid Media Plan",
    verdict: "Launch",
    statusSummary: "Composed plan",
    confidence: 0.8,
    sources: [{ title: "Source", url: "https://example.com" }],
    body,
    createdAt: "2026-06-17T00:00:00.000Z",
  } as unknown as ArtifactEnvelope;
}

function firstAudiencePack(
  result: ArtifactEnvelope,
): Record<string, unknown> | undefined {
  const audienceTypes = (result.body as Record<string, unknown>)
    .audienceTypes as Array<Record<string, unknown>>;
  return audienceTypes[0]?.evidencePack as
    | Record<string, unknown>
    | undefined;
}

describe("withPaidMediaEvidencePack", () => {
  it("grounds an audience row against a committed BuyerICP persona", () => {
    const artifact = buildPaidMediaArtifact({
      audienceTypes: [buildAudienceRow()],
    });

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {
        positioningBuyerICP: { body: buildBuyerICPBody() },
      },
    });

    const pack = firstAudiencePack(result);
    expect(pack).toBeDefined();
    expect(pack?.status).toBe("grounded");

    const refs = pack?.refs as Array<Record<string, unknown>>;
    expect(refs.length).toBeGreaterThanOrEqual(1);

    const personaRef = refs.find((ref) => ref.evidenceKind === "persona");
    expect(personaRef).toBeDefined();
    expect(personaRef?.sourceSection).toBe("positioningBuyerICP");
    expect(typeof personaRef?.locator).toBe("string");
    expect((personaRef?.locator as string).length).toBeGreaterThan(0);
    // Excerpt must be sliced verbatim from the persona row text.
    expect(personaRef?.excerpt).toContain("Dana Ruiz");
  });

  it("marks a gap when the cited section has no matching upstream row", () => {
    const artifact = buildPaidMediaArtifact({
      audienceTypes: [
        buildAudienceRow({
          sourceSection: "positioningBuyerICP",
          detail: "Targets enterprise security architects in fintech.",
          grounding: "Enterprise security architects evaluate fintech tooling.",
        }),
      ],
    });

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {
        positioningBuyerICP: { body: buildBuyerICPBody() },
      },
    });

    const pack = firstAudiencePack(result);
    expect(pack).toBeDefined();
    expect(pack?.status).toBe("gap");
    expect(pack?.refs).toEqual([]);
    expect(typeof pack?.note).toBe("string");
    expect((pack?.note as string).length).toBeGreaterThan(0);
  });

  it("grounds a competitorReview row against a committed VoC pain quote", () => {
    const artifact = buildPaidMediaArtifact({
      competitorReviewInsights: [buildCompetitorReviewRow()],
    });

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {
        positioningVoiceOfCustomer: { body: buildVoiceOfCustomerBody() },
      },
    });

    const rows = (result.body as Record<string, unknown>)
      .competitorReviewInsights as Array<Record<string, unknown>>;
    const pack = rows[0]?.evidencePack as Record<string, unknown>;
    expect(pack).toBeDefined();
    expect(pack.status).toBe("grounded");

    const refs = pack.refs as Array<Record<string, unknown>>;
    const painRef = refs.find((ref) => ref.evidenceKind === "painQuote");
    expect(painRef).toBeDefined();
    expect(painRef?.sourceSection).toBe("positioningVoiceOfCustomer");
    expect(typeof painRef?.excerpt).toBe("string");
    expect((painRef?.excerpt as string).toLowerCase()).toContain("handoff");
  });

  it("leaves an honest-gap row intact and omits evidencePack", () => {
    const gapRow = buildAudienceRow({
      detail: "Gap: targeting detail missing.",
      grounding: "Evidence gap: no buyer signal supplied.",
    });
    const artifact = buildPaidMediaArtifact({
      audienceTypes: [gapRow],
    });

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {
        positioningBuyerICP: { body: buildBuyerICPBody() },
      },
    });

    const audienceTypes = (result.body as Record<string, unknown>)
      .audienceTypes as Array<Record<string, unknown>>;
    const row = audienceTypes[0];
    expect(row.evidencePack).toBeUndefined();
    // The row's other content is untouched.
    expect(row.detail).toBe("Gap: targeting detail missing.");
    expect(row.archetype).toBe("High Intent - ABM ICP List");
  });

  it("is a no-op for a non-paid-media artifact", () => {
    const artifact = buildPaidMediaArtifact({
      audienceTypes: [buildAudienceRow()],
    });
    const buyerICPArtifact = {
      ...artifact,
      sectionId: "positioningBuyerICP",
    } as ArtifactEnvelope;

    const result = withPaidMediaEvidencePack({
      artifact: buyerICPArtifact,
      committedArtifacts: {
        positioningBuyerICP: { body: buildBuyerICPBody() },
      },
    });

    expect(result).toBe(buyerICPArtifact);
    const audienceTypes = (result.body as Record<string, unknown>)
      .audienceTypes as Array<Record<string, unknown>>;
    expect(audienceTypes[0].evidencePack).toBeUndefined();
  });

  it("does not over-match on shared stopwords alone", () => {
    const artifact = buildPaidMediaArtifact({
      audienceTypes: [
        buildAudienceRow({
          // Shares only stopwords ("the", "a", "to", "for") with the persona/trigger
          // identifiers — no anchor token overlap.
          detail: "We will be testing the audience for a while to see.",
          grounding: "The plan is to run the audience for a bit.",
        }),
      ],
    });

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {
        positioningBuyerICP: { body: buildBuyerICPBody() },
      },
    });

    const pack = firstAudiencePack(result);
    expect(pack?.status).toBe("gap");
    expect(pack?.refs).toEqual([]);
  });

  it("marks a gap when the cited upstream section is absent from committedArtifacts", () => {
    const artifact = buildPaidMediaArtifact({
      audienceTypes: [buildAudienceRow()],
    });

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {},
    });

    const pack = firstAudiencePack(result);
    expect(pack?.status).toBe("gap");
    expect(pack?.refs).toEqual([]);
    expect(typeof pack?.note).toBe("string");
  });

  it("returns a new artifact object rather than mutating the input", () => {
    const body = { audienceTypes: [buildAudienceRow()] };
    const artifact = buildPaidMediaArtifact(body);

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {
        positioningBuyerICP: { body: buildBuyerICPBody() },
      },
    });

    expect(result).not.toBe(artifact);
    // The original row was not mutated with an evidencePack.
    const originalRow = (artifact.body as Record<string, unknown>)
      .audienceTypes as Array<Record<string, unknown>>;
    expect(originalRow[0].evidencePack).toBeUndefined();
  });

  it("gaps a DemandIntent-cited angle — keyword rows are not quote-bearing deck-ledger evidence (LOCUS B reverted)", () => {
    const artifact = buildPaidMediaArtifact({
      anglesToTest: [buildDemandAngleRow()],
    });

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {
        positioningDemandIntent: { body: buildDemandIntentBody() },
      },
    });

    const angles = (result.body as Record<string, unknown>)
      .anglesToTest as Array<Record<string, unknown>>;
    const pack = angles[0]?.evidencePack as Record<string, unknown>;
    expect(pack).toBeDefined();
    // keywordDemand.keywords rows carry no (sourceUrl, quote) pair the
    // deck-ledger gate's resolveCellSourceUrls can resolve, so a keyword-only
    // citation MUST gap rather than bind to an unresolvable locator (binding
    // them produced 10 fabrication-cap violations on run harness-ramp-7acea2f3).
    expect(pack.status).toBe("gap");
  });

  it("writes a deterministic evidenceBinding rollup across synthesized rows", () => {
    const artifact = buildPaidMediaArtifact({
      // One audience row that binds to a committed BuyerICP persona and one that
      // gaps (no matching upstream row).
      audienceTypes: [
        buildAudienceRow(),
        buildAudienceRow({
          detail: "Targets enterprise security architects in aerospace.",
          grounding: "Enterprise security architects evaluate aerospace tooling.",
        }),
      ],
    });

    const result = withPaidMediaEvidencePack({
      artifact,
      committedArtifacts: {
        positioningBuyerICP: { body: buildBuyerICPBody() },
      },
    });

    const binding = (result.body as Record<string, unknown>).evidenceBinding as
      | Record<string, unknown>
      | undefined;
    expect(binding).toBeDefined();
    expect(binding?.groundedRows).toBe(1);
    expect(binding?.gapRows).toBe(1);
    expect(binding?.bindRate).toBe(0.5);
    // byTier tallies grounded refs by evidenceKind.
    expect((binding?.byTier as Record<string, number>).persona).toBe(1);
  });
});
